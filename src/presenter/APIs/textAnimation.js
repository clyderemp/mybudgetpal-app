export function animateNumber($element, targetNumber, additionalText) {
    let currentNumber = 0;
    const increment = targetNumber / 100; // Adjust the speed by changing 100 to a higher value

    // Set the initial number to 0
    $element.html(currentNumber + `${additionalText ? `<span style="font-size: 15px;">${additionalText}</span>`:''}`);

    // Function to animate the number
    const interval = setInterval(function() {
        currentNumber += increment;
        if (currentNumber >= targetNumber) {
            currentNumber = targetNumber; // Stop once target is reached
            clearInterval(interval); // Clear the interval when the target is met
        }
        $element.html(Math.round(currentNumber) + `${additionalText ? `<span style="font-size: 15px;">${additionalText}</span>`:''}`); // Update the number and append '%'
    }, 20); // Adjust the speed by changing the time (milliseconds)
}
