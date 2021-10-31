// Function to find the subsets with a target sum
export function findAllSubsets(arr, target) {
    let result = [];

    // Calculate the total no. of subsets
    let x = Math.pow(2, arr.length);

    // Run loop till total no. of subsets
    // and call the function for each subset
    for (let i = 1; i < x; i++) {
        const subset = findSubset(arr, i, target);
        if (subset && subset.length > 0) {
            result.push(subset);
        }
    }
    return result;
}

// Function to find the subsets with a target sum
function findSubset(set, n, target) {
    let subset = [];

    // Create the new array with length
    // equal to array set[] to create
    // binary array as per n(decimal number)
    let x = new Array(set.length);
    let j = set.length - 1;

    // Convert the array into binary array
    while (n > 0) {
        x[j] = n % 2;
        n = Math.floor(n / 2);
        j--;
    }

    let sum = 0;

    // Calculate the sum of this subset
    for (let i = 0; i < set.length; i++) {
        if (x[i] === 1) {
            sum = sum + set[i];
        }
    }

    // Check whether sum is equal to target
    // if it is equal, then create the subset
    if (sum === target) {
        for (let i = 0; i < set.length; i++) {
            if (x[i] === 1) {
                subset.push(set[i]);
            }
        }
    }
    return subset;
}
