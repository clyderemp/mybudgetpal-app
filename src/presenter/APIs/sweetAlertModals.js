import { reminderModalIsLaunched } from "./reminderManager.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

export async function launchConfirmationModal(actionText, questionText) {
    actionText = await capitalEachFirstLetter(actionText);
    const result = await Swal.fire({
      title: `Confirm ${actionText}?`,
      text: questionText,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes',
      cancelButtonText: 'No'
    });
  
    return result.isConfirmed;
}

export async function launchSuccessModal(actionText, successText) {
    actionText = await capitalEachFirstLetter(actionText);
    const result = await Swal.fire({
      title: `${actionText} Successful!`,
      text: successText,
      icon: 'success',
      showCancelButton: false,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Okay!',
    });
  
    return result.isConfirmed;
}

export async function launchReminderModal(imageUrl, title, content, confirmText, cancelText, onConfirmAction) {
  const result = await Swal.fire({
      title: title ? title : null,
      html: content ? content : null,
      imageUrl: imageUrl, // The URL for your custom image
      imageAlt: 'AL', // Alt text for the image (optional)
      imageWidth: 300, // Set the width of the image (adjust as needed)
      imageHeight: 250, // Set the height of the image (adjust as needed)
      showCancelButton: true, // Show cancel button
      confirmButtonText: confirmText ? confirmText : 'Got it!', // Customize confirm button text
      confirmButtonColor: 'green',
      cancelButtonText: cancelText ? cancelText : 'Cancel', // Customize cancel button text
      showCancelButton: cancelText ? true : false, // Show the cancel button
      reverseButtons: false, // Optionally reverse the buttons (Confirm left, Cancel right)
  });

  // Check if the user confirmed
  if (result.isConfirmed && onConfirmAction) {
      // Execute the callback function on confirmation
      onConfirmAction();
  }
}

export let loadingSwalInstance = null;
export async function launchLoadingModal() {

  // Show the loading Swal and store the instance
  loadingSwalInstance = await Swal.fire({
      title: 'Processing...',
      text: 'Please wait while we load the data.',
      allowOutsideClick: true,  // Prevent clicking outside to close
      didOpen: () => {
          Swal.showLoading();  // Show the spinner

          setTimeout(()=>{
            if(reminderModalIsLaunched){
              Swal.close();
            }
          },2000)
      }
  });
  
  return loadingSwalInstance;
}
