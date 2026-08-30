const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { getOrAssignVariant } = require('../db/miscRepo');
const { query } = require('../db/pool');

const router = express.Router();

/**
 * Deterministic bucketing (hash(userId + experiment) -> variant), persisted
 * so a user doesn't flip variants between requests. See
 * scripts/analysis/analyzeExperiment.js for the offline analysis side --
 * joining recommendation_events (what we served) against interactions
 * (what the user did) by experiment+variant to compute CTR/like-rate.
 *
 * HONESTY NOTE: with this project's traffic (one developer testing
 * locally), any numbers this produces are a demonstration of the mechanism,
 * not a statistically powered experiment. Do not treat output from
 * analyzeExperiment.js as a real result until there's real traffic behind
 * it -- the script itself prints a warning below the sample size it saw.
 */
router.get('/:experiment/variant', requireAuth, async (req, res, next) => {
  try {
    const variant = await getOrAssignVariant(req.userId, req.params.experiment);
    res.json({ data: { experiment: req.params.experiment, variant } });
  } catch (e) {
    next(e);
  }
});

router.get('/:experiment/results', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         ea.variant,
         COUNT(DISTINCT re.id) AS impressions,
         COUNT(DISTINCT i.id) FILTER (WHERE i.event_type = 'open') AS opens,
         COUNT(DISTINCT i.id) FILTER (WHERE i.event_type = 'like') AS likes
       FROM experiment_assignments ea
       LEFT JOIN recommendation_events re ON re.user_id = ea.user_id AND re.experiment = ea.experiment
       LEFT JOIN interactions i ON i.user_id = ea.user_id AND i.content_id = re.content_id
         AND i.created_at >= re.created_at
       WHERE ea.experiment = $1
       GROUP BY ea.variant`,
      [req.params.experiment]
    );
    const totalUsers = rows.reduce((s, r) => s + Number(r.impressions > 0 ? 1 : 0), 0);
    res.json({
      data: {
        experiment: req.params.experiment,
        variants: rows,
        warning:
          totalUsers < 200
            ? 'Sample size is small -- treat this as a demonstration of the experimentation mechanism, not a statistically significant result.'
            : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
