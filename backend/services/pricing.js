const db = require('../db');

// ---------------------------------------------------------------------------
// Discount engine (user-stories Rules 1-3, all tiers franchisor-configurable):
//   GROUP:   frequency discount first (2x -> 25%, 3x -> 35%), then multi-planet
//            percent (2 -> 5% ... 5 -> 20%) applied on the discounted amount.
//   PRIVATE: multi-session-per-week discount only. Private and group discounts
//            are never combined; private lines don't count toward planet count.
// ---------------------------------------------------------------------------

function tierFor(ruleType, count) {
  return db.prepare(
    `SELECT * FROM discount_tiers WHERE rule_type = ? AND threshold_count <= ?
     ORDER BY threshold_count DESC LIMIT 1`
  ).get(ruleType, count) || null;
}

function nextTier(ruleType, count) {
  return db.prepare(
    `SELECT * FROM discount_tiers WHERE rule_type = ? AND threshold_count > ?
     ORDER BY threshold_count ASC LIMIT 1`
  ).get(ruleType, count) || null;
}

function offeringDetail(offeringId) {
  return db.prepare(`
    SELECT o.id AS offering_id, o.location_id, o.ownership_id, o.local_price_cents,
           v.id AS variant_id, v.class_setting, v.sessions_per_week, v.list_price_cents,
           c.id AS course_id, c.session_minutes,
           l.id AS level_id, l.name AS level_name,
           p.id AS planet_id, p.name AS planet_name,
           loc.name AS location_name
    FROM offerings o
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses c ON c.id = v.course_id
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id
    JOIN locations loc ON loc.id = o.location_id
    WHERE o.id = ?`).get(offeringId);
}

// Existing active GROUP planets for a member (multi-planet count includes them)
function existingGroupPlanets(memberId) {
  if (!memberId) return new Set();
  const rows = db.prepare(`
    SELECT DISTINCT p.id FROM enrollments e
    JOIN offerings o ON o.id = e.offering_id
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses c ON c.id = v.course_id
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id
    WHERE e.member_id = ? AND e.status IN ('ACTIVE','NOTICE_GIVEN') AND v.class_setting = 'GROUP'
  `).all(memberId);
  return new Set(rows.map(r => r.id));
}

/**
 * Quote a cart.
 * items: [{ offering_id, member_id?, member_key?, batch_ids? }]
 * member_key groups lines for not-yet-created members during registration.
 * Returns { lines, setupFees, subtotal_cents, discount_cents, total_cents, suggestions }
 */
function quoteCart(items) {
  const lines = items.map((item, idx) => {
    const d = offeringDetail(item.offering_id);
    if (!d) throw new Error(`Offering not found: ${item.offering_id}`);
    const base = d.local_price_cents != null ? d.local_price_cents : d.list_price_cents;
    return { idx, item, d, base_cents: base, discounts: [], memberKey: item.member_id || item.member_key || 'self' };
  });

  // Group lines by member for the multi-planet count
  const byMember = new Map();
  for (const ln of lines) {
    if (!byMember.has(ln.memberKey)) byMember.set(ln.memberKey, []);
    byMember.get(ln.memberKey).push(ln);
  }

  const suggestions = [];

  for (const [memberKey, memberLines] of byMember) {
    const realMemberId = memberLines[0].item.member_id || null;
    const planetSet = existingGroupPlanets(realMemberId);
    for (const ln of memberLines) {
      if (ln.d.class_setting === 'GROUP') planetSet.add(ln.d.planet_id);
    }
    const planetCount = planetSet.size;
    const planetTier = tierFor('MULTI_PLANET', planetCount);

    for (const ln of memberLines) {
      let price = ln.base_cents;
      if (ln.d.class_setting === 'GROUP') {
        const freqTier = tierFor('GROUP_FREQUENCY', ln.d.sessions_per_week);
        if (freqTier) {
          const amt = Math.round(price * freqTier.percent / 100);
          ln.discounts.push({ tier_id: freqTier.id, amount_cents: amt, explanation: `${ln.d.sessions_per_week}x weekly: -${freqTier.percent}%` });
          price -= amt;
        }
        if (planetTier) {
          const amt = Math.round(price * planetTier.percent / 100);
          ln.discounts.push({ tier_id: planetTier.id, amount_cents: amt, explanation: `${planetCount} planets: -${planetTier.percent}%` });
          price -= amt;
        }
      } else {
        // PRIVATE — frequency discount only, never combined with group discounts
        const privTier = tierFor('PRIVATE_FREQUENCY', ln.d.sessions_per_week);
        if (privTier) {
          const amt = Math.round(price * privTier.percent / 100);
          ln.discounts.push({ tier_id: privTier.id, amount_cents: amt, explanation: `Private ${ln.d.sessions_per_week}x weekly: -${privTier.percent}%` });
          price -= amt;
        }
      }
      ln.final_cents = price;
    }

    // "You may like": adding one more planet unlocks the next tier
    const upNext = nextTier('MULTI_PLANET', planetCount);
    if (upNext && memberLines.some(l => l.d.class_setting === 'GROUP')) {
      suggestions.push({
        member_key: memberKey,
        message: planetCount < 2
          ? `Add a 2nd planet for this member and save ${upNext.percent}% on all group classes!`
          : `Add planet #${upNext.threshold_count} to unlock a ${upNext.percent}% multi-planet discount.`,
      });
    }
  }

  // One-time member setup fee: first course purchase per member
  const setupFeeCents = db.getConfigInt('MEMBER_SETUP_FEE_CENTS', 2500);
  const setupFees = [];
  for (const memberKey of byMember.keys()) {
    const realMemberId = byMember.get(memberKey)[0].item.member_id || null;
    let needsFee = true;
    if (realMemberId) {
      const m = db.prepare('SELECT setup_fee_paid_at FROM members WHERE id = ?').get(realMemberId);
      needsFee = !!m && !m.setup_fee_paid_at;
    }
    if (needsFee) setupFees.push({ member_key: memberKey, member_id: realMemberId, amount_cents: setupFeeCents });
  }

  const subtotal = lines.reduce((s, l) => s + l.base_cents, 0) + setupFees.reduce((s, f) => s + f.amount_cents, 0);
  const discount = lines.reduce((s, l) => s + l.discounts.reduce((a, d2) => a + d2.amount_cents, 0), 0);

  return {
    lines: lines.map(l => ({
      offering_id: l.d.offering_id,
      member_key: l.memberKey,
      member_id: l.item.member_id || null,
      batch_ids: l.item.batch_ids || [],
      planet_id: l.d.planet_id, planet_name: l.d.planet_name,
      level_id: l.d.level_id, level_name: l.d.level_name,
      location_id: l.d.location_id, location_name: l.d.location_name,
      class_setting: l.d.class_setting, sessions_per_week: l.d.sessions_per_week,
      session_minutes: l.d.session_minutes,
      base_cents: l.base_cents, discounts: l.discounts, final_cents: l.final_cents,
    })),
    setup_fees: setupFees,
    subtotal_cents: subtotal,
    discount_cents: discount,
    total_cents: subtotal - discount,
    suggestions,
  };
}

module.exports = { quoteCart, offeringDetail, tierFor };
