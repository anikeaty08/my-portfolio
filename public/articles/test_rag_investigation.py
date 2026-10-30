import unittest

from rag_investigation import DIRECT, PARAPHRASE, UNKNOWN, rank


class InvestigationTests(unittest.TestCase):
    def test_archived_policy_wins_without_freshness_filter(self):
        _, ranked = rank(DIRECT, current_only=False)
        self.assertEqual(ranked[0][1].source, "billing/refunds-2024.md")

    def test_filter_removes_archived_policy(self):
        _, ranked = rank(DIRECT, current_only=True)
        self.assertEqual(ranked[0][1].source, "billing/refunds.md")

    def test_paraphrase_needs_a_better_search_query(self):
        _, before = rank(PARAPHRASE, current_only=True)
        searched, after = rank(PARAPHRASE, current_only=True, rewrite_question=True)
        self.assertLess(before[0][0], 2)
        self.assertIn("annual", searched)
        self.assertEqual(after[0][1].source, "billing/refunds.md")
        self.assertGreaterEqual(after[0][0], 2)

    def test_missing_evidence_stays_below_threshold(self):
        _, ranked = rank(UNKNOWN, current_only=True)
        self.assertLess(ranked[0][0], 2)


if __name__ == "__main__":
    unittest.main()
