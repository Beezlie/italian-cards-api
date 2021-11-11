// Function to find the best possible player move
export function findHighestScoringMove(tableCards, playerCards) {
    let highestScoringMove = {};
    let bestScore = 0;
 
    for (const playerCard of playerCards) {
        const tableCardSum = tableCards
            .map(cardKey => getValueFromCardKey(cardKey))
            .reduce((a, b) => a + b, 0);
        if (getValueFromCardKey(playerCard) === tableCardSum) {
            // There is a scopa available - return as it's the best move possible
            return {
                card: playerCard,
                matches: tableCards,
            };
        }
        // Find the highest scoring available move
        for (const move of findAllMatchingCards(tableCards, playerCard)) {
            let score = 0;
            const allCards = [...move.matches, move.card];
            for (const card of allCards) {
                score += getHeuristicScoreFromCardKey(card);
            }
            if (score > bestScore) {
                highestScoringMove = move;
            }
        }
    }
    if (Object.keys(highestScoringMove).length === 0) {
        // Unable to pick up any cards

        //TODO - need a way for cpu to decide what card to drop if they can't pick up anything
        //They should ideally leave the sum of cards on the table above 10 and drop a card that is low scoring (not a 7 or sun)
        //Also they should want to discard lower cards if possible (ex. 1,2,3...)
    }
    return highestScoringMove;
}

// Function to find the subsets of cards that a target card can pick up
export function findAllMatchingCards(arr, target) {
    //This is an example of the perfect sum problem (NP hard). 
    //Luckily our set of cards wont be large so it shouldn't take too long to find the subsets
    let result = [];

    // Calculate the total no. of subsets
    let x = Math.pow(2, arr.length);

    // Run loop till total no. of subsets
    // and call the function for each subset
    for (let i = 1; i < x; i++) {
        const subset = findMatchingCards(arr, i, target);
        if (subset && subset.length > 0) {
            result.push({
                card: target,
                matches: subset,
            });
        }
    }
    return result;
}

function getValueFromCardKey(key) {
    return parseInt(key.slice(1));
}
function getHeuristicScoreFromCardKey(cardKey) {
    // Give cards a score based on their potential value to the player
    let score = 1;
    if (cardKey === 's7') {
        score += 9;
    } else if (cardKey.endsWith('7')) {
        score += 5;
    } else if (cardKey.startsWith('s')) {
        score += 3;
    }
    return score;
}

// Function to find the subsets with a target sum
function findMatchingCards(set, n, target) {
    let subset = [];

    // Convert the card keys to numeric form
    const numSet = set.map(card => getValueFromCardKey(card));
    const numTarget = getValueFromCardKey(target);

    // Create the new array with length
    // equal to array set[] to create
    // binary array as per n(decimal number)
    let x = new Array(numSet.length);
    let j = numSet.length - 1;

    // Convert the array into binary array
    while (n > 0) {
        x[j] = n % 2;
        n = Math.floor(n / 2);
        j--;
    }

    let sum = 0;

    // Calculate the sum of this subset
    for (let i = 0; i < numSet.length; i++) {
        if (x[i] === 1) {
            sum = sum + numSet[i];
        }
    }

    // Check whether sum is equal to target
    // if it is equal, then create the subset
    if (sum === numTarget) {
        for (let i = 0; i < set.length; i++) {
            if (x[i] === 1) {
                subset.push(set[i]);
            }
        }
    }
    return subset;
}
