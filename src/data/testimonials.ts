// Single source of truth for the about-page testimonials. Consumed by:
//   - classic  src/components/DefaultAbout.astro (scrolling marquee)
//   - blueprint themes/blueprint/src/lounge.js (guest book on the coffee table),
//     via tools/build-blueprint.mjs → src/site-data.generated.js
// Transit's about platform has no testimonial card.
//
// Import-free by contract — see the note in music.ts.

export interface Testimonial {
  quote: string;
  /** Name + relation, rendered after an em dash. */
  author: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Rohan was here for me when I was down, and I'm never gonna forget that. I'm still down though so he's still here.",
    author: 'Sidharth M., friend',
  },
  { quote: 'He is the only one who likes the Instagram reels I send.', author: 'Lin S., friend' },
  {
    quote: 'Rohan is a radiant sun in the darkness, a warm blanket on a rainy night.',
    author: 'Dylan C., friend',
  },
  { quote: 'Please hire my brother.', author: 'Ankit K., brother' },
  { quote: 'He was one of the roommates I ever had.', author: 'Feng Kai P., friend' },
  { quote: 'He helps me with any computer problems.', author: 'Rachele M., friend' },
  {
    quote: 'He kindly humors my terrible music recommendations. Great guy.',
    author: 'Hrishi S., friend',
  },
  {
    quote: 'Using his programming expertise and high IQ, he designed a program to help me.',
    author: 'Sarah O., friend',
  },
  { quote: 'A dependable friend who always makes time to see me.', author: 'Anish K., friend' },
  { quote: "Easily in the top 3 children we've ever had.", author: 'Mum and Dad, Parents of 3' },
  {
    quote: 'I remember his first words to me: be calm, sister, for I am here now.',
    author: 'Arisha K., sister',
  },
];
