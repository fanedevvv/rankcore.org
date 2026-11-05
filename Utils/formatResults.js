const pb = {
    leGreen: '<:LEgreen:1567796933307666515>',
    meGreen: '<:MEgreen:1567796937921400862>',
    reGreen: '<:REgreen:1567796944548536382>',
    lfGreen: '<:LFgreen:1567796935601950730>',
    mfGreen: '<:MFgreen:1567796940421333002>',
    rfGreen: '<:RFgreen:1567796946876371047>',
    leRed: '<:LEred:1567796934545121280>',
    meRed: '<:MEred:1567796939003666463>',
    reRed: '<:REred:1567796945752166490>',
    lfRed: '<:LFred:1567796936814104626>',
    mfRed: '<:MFred:1567796941549604915>',
    rfRed: '<:RFred:1567796948092583996>',
};

function calculateColor(upvotePercentage, downvotePercentage) {
    if (upvotePercentage === 0) {
        return 'red'; // All downvotes, set to red
    } else if (downvotePercentage === 0) {
        return 'green'; // All upvotes, set to green
    } else {
        return 'mixed'; // Mixed votes, set to a mix of green and red
    }
}

function formatResults(upvotes = [], downvotes = []) {
    const totalVotes = upvotes.length + downvotes.length;
    const progressBarLength = 12; // Reduced length to fit in embed

    const upvotePercentage = totalVotes > 0 ? upvotes.length / totalVotes : 0;
    const downvotePercentage = totalVotes > 0 ? downvotes.length / totalVotes : 0;

    const color = calculateColor(upvotePercentage, downvotePercentage);

    // Calculate the number of green and red segments (excluding the left and right ends)
    const totalMiddleSegments = progressBarLength - 2; // 10 middle segments (12 total - 2 for ends)
    let greenMiddleSegments = Math.round(upvotePercentage * totalMiddleSegments);
    let redMiddleSegments = Math.round(downvotePercentage * totalMiddleSegments);

    // Adjust to ensure the total middle segments add up to 10
    const totalMiddle = greenMiddleSegments + redMiddleSegments;
    if (totalMiddle > totalMiddleSegments) {
        const excess = totalMiddle - totalMiddleSegments;
        if (greenMiddleSegments > redMiddleSegments) {
            greenMiddleSegments -= excess;
        } else {
            redMiddleSegments -= excess;
        }
    } else if (totalMiddle < totalMiddleSegments) {
        const remaining = totalMiddleSegments - totalMiddle;
        if (greenMiddleSegments < redMiddleSegments) {
            greenMiddleSegments += remaining;
        } else {
            redMiddleSegments += remaining;
        }
    }

    const upPercentage = upvotePercentage * 100 || 0;
    const downPercentage = downvotePercentage * 100 || 0;

    // Build the progress bar
    let progressBar = '';
    if (color === 'red') {
        progressBar = pb.lfRed + pb.mfRed.repeat(totalMiddleSegments) + pb.rfRed;
    } else if (color === 'green') {
        progressBar = pb.lfGreen + pb.mfGreen.repeat(totalMiddleSegments) + pb.rfGreen;
    } else {
        // Mixed case: Add green segments on the left, red segments on the right
        progressBar += greenMiddleSegments > 0 ? pb.lfGreen : pb.leGreen; // Left end
        progressBar += pb.mfGreen.repeat(Math.max(0, greenMiddleSegments)); // Middle green segments
        progressBar += pb.mfRed.repeat(Math.max(0, redMiddleSegments)); // Middle red segments
        progressBar += redMiddleSegments > 0 ? pb.rfRed : pb.reRed; // Right end
    }

    const results = [];
    results.push(
        `:thumbsup: ${upvotes.length} upvotes (${upPercentage.toFixed(1)}%) • :thumbsdown: ${
            downvotes.length
        } downvotes (${downPercentage.toFixed(1)}%)`
    );
    results.push(progressBar);

    return results.join('\n');
}

module.exports = formatResults;