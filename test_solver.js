/**
 * test_solver.js
 * Test suite to verify Clue deduction intelligence engine.
 */

import { solveGame, STATES } from './solver.js';

// Setup Mock Cards (Classic Clue)
const cards = [
  // Suspects
  { id: 'mustard', name: 'Col. Mustard', category: 'suspect' },
  { id: 'scarlet', name: 'Miss Scarlet', category: 'suspect' },
  { id: 'green', name: 'Mr. Green', category: 'suspect' },
  { id: 'peacock', name: 'Mrs. Peacock', category: 'suspect' },
  { id: 'white', name: 'Mrs. White', category: 'suspect' },
  { id: 'plum', name: 'Prof. Plum', category: 'suspect' },
  // Weapons
  { id: 'candlestick', name: 'Candlestick', category: 'weapon' },
  { id: 'knife', name: 'Knife', category: 'weapon' },
  { id: 'leadpipe', name: 'Lead Pipe', category: 'weapon' },
  { id: 'revolver', name: 'Revolver', category: 'weapon' },
  { id: 'rope', name: 'Rope', category: 'weapon' },
  { id: 'wrench', name: 'Wrench', category: 'weapon' },
  // Rooms
  { id: 'kitchen', name: 'Kitchen', category: 'room' },
  { id: 'ballroom', name: 'Ballroom', category: 'room' },
  { id: 'conservatory', name: 'Conservatory', category: 'room' },
  { id: 'diningroom', name: 'Dining Room', category: 'room' },
  { id: 'billiardroom', name: 'Billiard Room', category: 'room' },
  { id: 'library', name: 'Library', category: 'room' },
  { id: 'lounge', name: 'Lounge', category: 'room' },
  { id: 'hall', name: 'Hall', category: 'room' },
  { id: 'study', name: 'Study', category: 'room' }
];

// Setup 3 Players (18 cards divided by 3 = 6 cards each)
const players = [
  { id: 'alice', name: 'Alice', cardCount: 6 },
  { id: 'bob', name: 'Bob', cardCount: 6 },
  { id: 'charlie', name: 'Charlie', cardCount: 6 }
];

function runTests() {
  console.log('--- Running Clue Solver Tests ---');

  // Test 1: Simple Card Uniqueness Propagation
  {
    console.log('\nTest 1: Simple Uniqueness propagation...');
    const userGrid = {
      alice: { scarlet: STATES.YES } // Alice manually has Miss Scarlet
    };

    const { grid, contradiction } = solveGame(cards, players, userGrid);

    if (contradiction) {
      console.error('❌ Test 1 Failed: Got contradiction', contradiction);
      process.exit(1);
    }

    // Verify Bob and Charlie are marked as NO for Scarlet
    if (grid.bob.scarlet !== STATES.NO || grid.charlie.scarlet !== STATES.NO || grid.envelope.scarlet !== STATES.NO) {
      console.error('❌ Test 1 Failed: Miss Scarlet was not marked NO for other players');
      process.exit(1);
    }
    console.log('✅ Test 1 Passed!');
  }

  // Test 2: Passing Refutations
  {
    console.log('\nTest 2: Refutation and suggestion pass logic...');
    // Alice suggests Mustard + Candlestick + Study.
    // Bob passes (so Bob has none of these).
    // Charlie refutes and shows Candlestick.
    const suggestions = [
      {
        suggesterId: 'alice',
        suspectId: 'mustard',
        weaponId: 'candlestick',
        roomId: 'study',
        refuterId: 'charlie',
        passedPlayerIds: ['bob'],
        revealedCardId: 'candlestick'
      }
    ];

    const { grid, contradiction } = solveGame(cards, players, {}, suggestions);

    if (contradiction) {
      console.error('❌ Test 2 Failed: Got contradiction', contradiction);
      process.exit(1);
    }

    // Bob passed: should have NO for mustard, candlestick, study
    if (grid.bob.mustard !== STATES.NO || grid.bob.candlestick !== STATES.NO || grid.bob.study !== STATES.NO) {
      console.error('❌ Test 2 Failed: Bob passing did not set his cards to NO', grid.bob);
      process.exit(1);
    }

    // Charlie refuted with Candlestick: should be YES for Charlie
    if (grid.charlie.candlestick !== STATES.YES) {
      console.error('❌ Test 2 Failed: Charlie did not get Candlestick as YES');
      process.exit(1);
    }
    console.log('✅ Test 2 Passed!');
  }

  // Test 3: Suggestion deduction (Process of elimination)
  {
    console.log('\nTest 3: Suggestion deduction with process of elimination...');
    // Alice suggests Peacock + Revolver + Ballroom.
    // Bob refutes (we don't know which card he showed).
    // But we know Peacock is in the Envelope (so Bob doesn't have it).
    // And Revolver is owned by Charlie (so Bob doesn't have it).
    // Thus, Bob MUST have Ballroom!
    const userGrid = {
      envelope: { peacock: STATES.YES },
      charlie: { revolver: STATES.YES }
    };

    const suggestions = [
      {
        suggesterId: 'alice',
        suspectId: 'peacock',
        weaponId: 'revolver',
        roomId: 'ballroom',
        refuterId: 'bob',
        passedPlayerIds: [],
        revealedCardId: null
      }
    ];

    const { grid, reasons, contradiction } = solveGame(cards, players, userGrid, suggestions);

    if (contradiction) {
      console.error('❌ Test 3 Failed: Got contradiction', contradiction);
      process.exit(1);
    }

    if (grid.bob.ballroom !== STATES.YES) {
      console.error('❌ Test 3 Failed: Bob was not deduced to have Ballroom', grid.bob);
      process.exit(1);
    }

    console.log('Deduction Reason:', reasons.bob.ballroom);
    console.log('✅ Test 3 Passed!');
  }

  // Test 4: Card Caps
  {
    console.log('\nTest 4: Player card limits...');
    // Alice holds 6 cards.
    // If we mark 6 cards as YES for Alice, all other 15 cards should be marked NO for Alice.
    const userGrid = {
      alice: {
        mustard: STATES.YES,
        candlestick: STATES.YES,
        kitchen: STATES.YES,
        ballroom: STATES.YES,
        conservatory: STATES.YES,
        diningroom: STATES.YES
      }
    };

    const { grid, contradiction } = solveGame(cards, players, userGrid);

    if (contradiction) {
      console.error('❌ Test 4 Failed: Got contradiction', contradiction);
      process.exit(1);
    }

    // Verify some other card is NO for Alice
    if (grid.alice.plum !== STATES.NO || grid.alice.wrench !== STATES.NO) {
      console.error('❌ Test 4 Failed: Alice other cards did not get marked as NO', grid.alice);
      process.exit(1);
    }
    console.log('✅ Test 4 Passed!');
  }

  console.log('\n🎉 ALL SOLVER TESTS PASSED FLawlessly! 🎉');
}

runTests();
