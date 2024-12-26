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