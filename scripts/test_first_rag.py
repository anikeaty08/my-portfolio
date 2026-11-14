import unittest

from first_rag import build_prompt, search


class FirstRagTests(unittest.TestCase):
    def test_marks_question_finds_the_revaluation_rule(self):
        score, source, _ = search("Can I apply for re-evaluation of my marks 20 days after the result?")[0]
        self.assertEqual(source, "exams/revaluation.md")
        self.assertGreaterEqual(score, 2)

    def test_unrelated_question_has_no_supported_result(self):
        self.assertLess(search("Does the college offer hostel rooms?")[0][0], 2)

    def test_prompt_carries_the_selected_source(self):
        prompt = build_prompt("Re-evaluation after 20 days?", "exams/revaluation.md", "15 days")
        self.assertIn("[1] exams/revaluation.md", prompt)
        self.assertIn("15 days", prompt)


if __name__ == "__main__":
    unittest.main()
