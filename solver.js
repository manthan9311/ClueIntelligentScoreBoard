/**
 * solver.js
 * Core logical deduction engine for Clue scorecard tracker.
 * Implements a constraint propagation solver for Clue rules.
 */

// Cell states
export const STATES = {
  MAYBE: 0,
  YES: 1,
  NO: -1
};

/**
 * Solves the Clue grid state using constraint propagation.
 * 
 * @param {Array} cards - Array of card objects: { id: string, name: string, category: 'suspect'|'weapon'|'room' }
 * @param {Array} players - Array of player objects: { id: string, name: string, cardCount: number }
 * @param {Object} userGrid - 2D map: userGrid[playerId][cardId] = STATES.YES | STATES.NO | STATES.MAYBE
 *                            (Note: 'envelope' is a valid playerId)
 * @param {Array} suggestions - Array of suggestion objects:
 *    {
 *      suggesterId: string,
 *      suspectId: string,
 *      weaponId: string,
 *      roomId: string,
 *      refuterId: string|null, // null if no one refuted
 *      passedPlayerIds: Array<string>, // players who passed
 *      revealedCardId: string|null // exact card shown to us, if known
 *    }
 * @returns {Object} { grid: deducedGrid, reasons: Object, contradiction: string|null }
 *    - grid: 2D map of deduced states
 *    - reasons: 2D map: reasons[playerId][cardId] = string explanation of why it was deduced
 *    - contradiction: error message if a logical contradiction was detected
 */
export function solveGame(cards, players, userGrid, suggestions = []) {
  // Initialize the deduced grid state with user choices
  const grid = {};
  const reasons = {};
  let contradiction = null;

  // Include envelope in player lists for grid representation
  const allEntities = [...players.map(p => p.id), 'envelope'];
  
  // Set up initial state
  allEntities.forEach(entityId => {
    grid[entityId] = {};
    reasons[entityId] = {};
    cards.forEach(card => {
      const userVal = (userGrid[entityId] && userGrid[entityId][card.id]) !== undefined
        ? userGrid[entityId][card.id]
        : STATES.MAYBE;
      
      grid[entityId][card.id] = userVal;
      if (userVal !== STATES.MAYBE) {
        reasons[entityId][card.id] = 'Manually marked';
      } else {
        reasons[entityId][card.id] = null;
      }
    });
  });

  // Keep track of cards counts
  const playerCardCaps = {};
  players.forEach(p => {
    playerCardCaps[p.id] = p.cardCount;
  });
  // Envelope contains exactly 1 suspect, 1 weapon, 1 room (total 3 cards)
  playerCardCaps['envelope'] = 3;

  // Limit iterations to prevent any potential infinite loops
  const MAX_ITERATIONS = 50;
  let iterations = 0;
  let changed = true;

  // Helper to mark a cell and record reason
  function mark(entityId, cardId, state, reason) {
    if (grid[entityId][cardId] === state) return false;
    
    // Check for contradiction
    if (grid[entityId][cardId] !== STATES.MAYBE) {
      contradiction = `Contradiction detected: Cell for ${entityId} and card ${cardId} is already marked as ${grid[entityId][cardId] === STATES.YES ? 'YES' : 'NO'}, but solver deduced it should be ${state === STATES.YES ? 'YES' : 'NO'} because: "${reason}".`;
      return false;
    }

    grid[entityId][cardId] = state;
    reasons[entityId][cardId] = reason;
    changed = true;
    return true;
  }

  while (changed && !contradiction && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    // 1. Uniqueness rules & cross-cell propagation
    cards.forEach(card => {
      // If a card is YES for someone, it is NO for everyone else
      let ownerId = null;
      allEntities.forEach(entityId => {
        if (grid[entityId][card.id] === STATES.YES) {
          if (ownerId && ownerId !== entityId) {
            contradiction = `Contradiction: Card ${card.name} is marked as YES for both ${ownerId} and ${entityId}.`;
          }
          ownerId = entityId;
        }
      });

      if (ownerId) {
        allEntities.forEach(entityId => {
          if (entityId !== ownerId) {
            mark(entityId, card.id, STATES.NO, `Card is owned by ${ownerId === 'envelope' ? 'the Envelope' : ownerId}`);
          }
        });
      }

      // If a card is NO for everyone else, it must be YES for the last one
      const noEntities = allEntities.filter(entityId => grid[entityId][card.id] === STATES.NO);
      if (noEntities.length === allEntities.length - 1) {
        const remainingEntity = allEntities.find(entityId => grid[entityId][card.id] === STATES.MAYBE);
        if (remainingEntity) {
          mark(remainingEntity, card.id, STATES.YES, `Process of elimination: all other players do not have this card`);
        }
      } else if (noEntities.length === allEntities.length) {
        contradiction = `Contradiction: Card ${card.name} is marked NO for all players and the envelope.`;
      }
    });

    if (contradiction) break;

    // 2. Envelope Category Constraints (Exactly 1 of each category)
    ['suspect', 'weapon', 'room'].forEach(category => {
      const catCards = cards.filter(c => c.category === category);
      
      // If one card of this category is YES in envelope, all other cards in this category are NO in envelope
      let yesCard = null;
      catCards.forEach(c => {
        if (grid['envelope'][c.id] === STATES.YES) {
          yesCard = c;
        }
      });

      if (yesCard) {
        catCards.forEach(c => {
          if (c.id !== yesCard.id) {
            mark('envelope', c.id, STATES.NO, `The Envelope already contains ${yesCard.name} as the ${category}`);
          }
        });
      }

      // If all cards in a category except one are NO in envelope, that last one must be YES in envelope
      const noCards = catCards.filter(c => grid['envelope'][c.id] === STATES.NO);
      if (noCards.length === catCards.length - 1) {
        const remainingCard = catCards.find(c => grid['envelope'][c.id] === STATES.MAYBE);
        if (remainingCard) {
          mark('envelope', remainingCard.id, STATES.YES, `Process of elimination: all other ${category}s are held by players`);
        }
      } else if (noCards.length === catCards.length) {
        contradiction = `Contradiction: All ${category}s are marked as NO in the envelope.`;
      }
    });

    if (contradiction) break;

    // 3. Player Card Count Caps
    allEntities.forEach(entityId => {
      const cap = playerCardCaps[entityId];
      if (cap === undefined || cap === null) return;

      const yesCards = cards.filter(c => grid[entityId][c.id] === STATES.YES);
      const maybeCards = cards.filter(c => grid[entityId][c.id] === STATES.MAYBE);
      const noCards = cards.filter(c => grid[entityId][c.id] === STATES.NO);

      // If a player has reached their card cap, all other cards are NO
      if (yesCards.length === cap) {
        maybeCards.forEach(c => {
          mark(entityId, c.id, STATES.NO, `Player has reached their card limit of ${cap}`);
        });
      } else if (yesCards.length > cap) {
        contradiction = `Contradiction: Entity ${entityId === 'envelope' ? 'Envelope' : entityId} has ${yesCards.length} cards marked YES, which exceeds their limit of ${cap}.`;
      }

      // If the remaining possible cards (YES + MAYBE) equals the cap, then all MAYBE cards must be YES
      if (cards.length - noCards.length === cap) {
        maybeCards.forEach(c => {
          mark(entityId, c.id, STATES.YES, `Process of elimination: player must hold this card to satisfy their card count of ${cap}`);
        });
      } else if (cards.length - noCards.length < cap) {
        contradiction = `Contradiction: Entity ${entityId === 'envelope' ? 'Envelope' : entityId} needs to have ${cap} cards, but only ${cards.length - noCards.length} are possible.`;
      }
    });

    if (contradiction) break;

    // 4. Suggestions and Refutations Logic
    suggestions.forEach((sugg, suggIdx) => {
      const { suspectId, weaponId, roomId, refuterId, passedPlayerIds, revealedCardId } = sugg;
      const suggNum = suggIdx + 1;

      // Rule A: Anyone who passed does NOT have any of the 3 cards
      passedPlayerIds.forEach(passedId => {
        [suspectId, weaponId, roomId].forEach(cardId => {
          const cardName = cards.find(c => c.id === cardId)?.name || 'card';
          mark(passedId, cardId, STATES.NO, `Passed on Suggestion #${suggNum} containing ${cardName}`);
        });
      });

      // Rule B: If a card was revealed to us, that player has that card
      if (refuterId && revealedCardId) {
        const cardName = cards.find(c => c.id === revealedCardId)?.name || 'card';
        mark(refuterId, revealedCardId, STATES.YES, `Revealed this card in Suggestion #${suggNum}`);
      }

      // Rule C: If a player refuted but we don't know the card, they must own at least one of the 3 cards
      if (refuterId && !revealedCardId) {
        const refuterState = [suspectId, weaponId, roomId].map(cardId => ({
          id: cardId,
          state: grid[refuterId][cardId],
          name: cards.find(c => c.id === cardId)?.name || 'card'
        }));

        const yesRefs = refuterState.filter(s => s.state === STATES.YES);
        const maybeRefs = refuterState.filter(s => s.state === STATES.MAYBE);
        const noRefs = refuterState.filter(s => s.state === STATES.NO);

        if (noRefs.length === 3) {
          contradiction = `Contradiction: Player ${refuterId} refuted Suggestion #${suggNum} but is marked as NOT having any of those cards (${refuterState.map(s => s.name).join(', ')}).`;
        } else if (yesRefs.length === 0 && maybeRefs.length === 1) {
          // If 2 of the cards are NO, the 3rd must be YES!
          const target = maybeRefs[0];
          mark(refuterId, target.id, STATES.YES, `Refuted Suggestion #${suggNum} and is known not to have the other suggested cards (${noRefs.map(n => n.name).join(', ')})`);
        }
      }
    });
  }

  return { grid, reasons, contradiction };
}
