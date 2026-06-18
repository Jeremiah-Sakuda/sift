/**
 * Hand-labeled entailment cases for the Verify accuracy eval.
 *
 * Each case is a (claim, source excerpt, expected verdict) triple. Keep them
 * short and unambiguous; add cases when a real-world miss is found. Run with:
 *   ANTHROPIC_API_KEY=sk-... npm run eval
 */

import type { Label } from './score';

export interface EvalCase {
  claim: string;
  source: string;
  expected: Label;
}

export const ENTAILMENT_CASES: EvalCase[] = [
  {
    claim: 'The Eiffel Tower is located in Paris.',
    source: 'The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.',
    expected: 'supported',
  },
  {
    claim: 'Water boils at 100°C at sea level.',
    source: 'At standard atmospheric pressure (sea level), pure water boils at 100 degrees Celsius.',
    expected: 'supported',
  },
  {
    claim: 'Python is a programming language.',
    source: 'Python is a high-level, general-purpose programming language first released in 1991.',
    expected: 'supported',
  },
  {
    claim: 'Shakespeare wrote Hamlet.',
    source: 'Hamlet is a tragedy written by William Shakespeare sometime between 1599 and 1601.',
    expected: 'supported',
  },
  {
    claim: 'The speed of light is about 300,000 km/s.',
    source: 'Light travels at approximately 299,792 kilometers per second in a vacuum.',
    expected: 'supported',
  },
  {
    claim: 'Mount Everest is 9,000 meters tall.',
    source: 'Mount Everest stands at 8,849 meters (29,032 feet) above sea level.',
    expected: 'unsupported',
  },
  {
    claim: 'The study included 5,000 participants.',
    source: 'The randomized trial enrolled 500 participants across three sites.',
    expected: 'unsupported',
  },
  {
    claim: 'Vaccines cause autism.',
    source: 'Multiple large epidemiological studies have found no link between vaccines and autism.',
    expected: 'unsupported',
  },
  {
    claim: 'The Great Wall of China is visible from the Moon with the naked eye.',
    source: 'Astronauts have confirmed the Great Wall is not visible from the Moon without aid.',
    expected: 'unsupported',
  },
  {
    claim: 'The company was founded in 2010 in Boston by two engineers.',
    source: 'Acme Corp was founded in 2010.',
    expected: 'partial',
  },
  {
    claim: 'The drug reduced symptoms by 50% within a week.',
    source: 'In the trial, the drug reduced reported symptoms compared with placebo.',
    expected: 'partial',
  },
  {
    claim: 'Sales grew 30% across Europe and Asia in 2023.',
    source: 'The company reported that total sales grew 30% in 2023.',
    expected: 'partial',
  },
  {
    claim: 'The Golden Gate Bridge, completed in 1937, cost $35 million to build.',
    source: 'The Golden Gate Bridge opened to traffic in 1937.',
    expected: 'partial',
  },
  {
    claim: 'The 1648 treaty ended the Thirty Years War.',
    source: 'Shop our latest running shoes and athletic apparel with free shipping.',
    expected: 'unverifiable',
  },
  {
    claim: 'The CEO resigned in March.',
    source: 'Page not found. The content you are looking for may have moved. Return to home.',
    expected: 'unverifiable',
  },
  {
    claim: 'The new policy takes effect next quarter.',
    source: 'Subscribe to our newsletter for weekly cooking recipes and meal plans.',
    expected: 'unverifiable',
  },
];
