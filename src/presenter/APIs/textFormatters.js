export async function capitalEachFirstLetter(string) {
    // Split the string into an array of words
    const words = string.split(' ');

    // Capitalize the first letter of each word and join them back into a string
    const capitalizedWords = words.map(word => {
        // Capitalize the first letter and make the rest lowercase
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

    // Join the array of capitalized words back into a single string
    return capitalizedWords.join(' ');
}
