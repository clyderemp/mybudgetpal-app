export async function downloadPDFFile(htmlID, fileName){
    const { jsPDF } = window.jspdf;  // Destructure jsPDF from window
    const htmlRef = $(`#${htmlID}`)[0];
    // Use html2canvas to capture the entire div and ensure the whole content is included
    html2canvas(htmlRef, {
        logging: true,  // Enables logging for debugging
        useCORS: true,  // Allows CORS requests for images
        allowTaint: true,  // Allows tainted canvases for cross-origin images
        scrollX: 0, // Disable any scrolling effect
        scrollY: -window.scrollY,  // Capture content relative to the viewport
        width: htmlRef.scrollWidth,  // Set width to capture full content (including overflow)
        height: htmlRef.scrollHeight  // Set height to capture full content (including overflow)
        }).then(function (canvas) {
        if (canvas) {
            const imgData = canvas.toDataURL('image/png');  // Get the image data from the canvas
            const { jsPDF } = window.jspdf;  // Initialize jsPDF
            const doc = new jsPDF('l', 'mm', 'a4');  // Create PDF in landscape orientation with A4 size (297mm x 210mm)

            // Calculate scaling factor to fit content into the page
            const pdfWidth = 297;  // A4 landscape width in mm
            const pdfHeight = 210; // A4 landscape height in mm

            const canvasWidth = canvas.width;  // Original canvas width in px
            const canvasHeight = canvas.height;  // Original canvas height in px

            // Calculate scaling factors based on the content dimensions
            const scaleX = pdfWidth / (canvasWidth * 0.75);  // Adjust the 0.75 factor to scale content
            const scaleY = pdfHeight / (canvasHeight * 0.75);  // Adjust the 0.75 factor to scale content

            const scale = Math.min(scaleX, scaleY);  // Take the smaller scale to ensure content fits

            // Add the image to the PDF with scaling applied
            doc.addImage(imgData, 'PNG', 10, 10, canvasWidth * scale, canvasHeight * scale);

            // Save the generated PDF
            doc.save(`${fileName}.pdf`);
        } else {
            console.error('html2canvas failed to generate the canvas.');
        }
    });
}