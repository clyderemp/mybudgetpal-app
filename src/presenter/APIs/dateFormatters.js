export function getFormattedTodayDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');   // Ensure two digits for day
    const month = String(date.getMonth()+1).padStart(2, '0'); // Ensure two digits for month
    const year = date.getFullYear();

    return `${year}-${month}-${day}`;  // Format as YYYY-MM-DD
}

export function getStartOfMonth(){
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');   // Ensure two digits for day
    const month = String(date.getMonth()+1).padStart(2, '0'); // Ensure two digits for month
    const year = date.getFullYear();

    return `${year}-${month}-01`;  // Format as YYYY-MM-DD
}

export function convertToFormattedDate(dateObj){

    const day = String(dateObj.getDate()).padStart(2, '0');   // Ensure two digits for day
    const month = String(dateObj.getMonth()+1).padStart(2, '0'); // Ensure two digits for month
    const year = dateObj.getFullYear();

    return `${year}-${month}-${day}`;  // Format as YYYY-MM-DD
}

export function convertFormattedDateBack(dateString){
    // Ensure the input is a string and matches the expected YYYY-MM-DD format
    if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid date format. Expected YYYY-MM-DD.");
    }

    // Convert the YYYY-MM-DD formatted string to a Date object
    const dateObj = new Date(dateString);

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
        throw new Error("Invalid date value.");
    }

    return dateObj;
}

//FOR MONTHS
export const reg_month_strings = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
export const short_month_strings = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
export const days_of_the_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];