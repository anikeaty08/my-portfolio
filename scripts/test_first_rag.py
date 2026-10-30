import unittest

from first_rag import build_prompt, search


class FirstRagTests(unittest.TestCase):
    def test_refund_question_finds_the_annual_policy(self):
        score, source, _ = search("Can I get a refund on my yearly plan after 45 days?")[0]
        self.assertEqual(source, "billing/refunds.md")
        self.assertGreaterEqual(score, 2)

    def test_unrelated_question_has_no_supported_result(self):
        self.assertLess(search("Do you support Kubernetes deployments?")[0][0], 2)

    def test_prompt_carries_the_selected_source(self):
        prompt = build_prompt("Refund after 45 days?", "billing/refunds.md", "30 days")
        self.assertIn("[1] billing/refunds.md", prompt)
        self.assertIn("30 days", prompt)


if __name__ == "__main__":
    unittest.main()
