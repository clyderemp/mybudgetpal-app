import { uid } from "../../../../main.js";
import { convertToFormattedDate } from "../../../presenter/APIs/dateFormatters.js";

export async function topbarActionHandlers(){
    $('#reset-filter-btn').on('click', async function(){
        await localStorage.removeItem('startDateFilter');
        await localStorage.removeItem('endDateFilterVal');
    });
    $('#start-date-filter').on('change', async function() {
        const selectedDate = $(this).val();  // Get the selected date as a string (YYYY-MM-DD)
        console.log('Start Date selected:', selectedDate);
    
        // Convert it to a JavaScript Date object (if needed)
        const dateObject = new Date(selectedDate);
        
        if (isNaN(dateObject.getTime())) {
            console.log("Invalid date selected");
        } else {
            const formattedDate = await convertToFormattedDate(dateObject);
            console.log('Selected Start Date as Date object:', dateObject);
            await localStorage.setItem('startDateFilter', formattedDate);
            window.location.reload();
        }
    
        // You can perform further actions using the selected date here
    });

    $('#end-date-filter').on('change', async function() {
        const selectedDate = $(this).val();  // Get the selected date as a string (YYYY-MM-DD)
        console.log('End Date selected:', selectedDate);
    
        // Convert it to a JavaScript Date object (if needed)
        const dateObject = new Date(selectedDate);
        
        if (isNaN(dateObject.getTime())) {
            console.log("Invalid date selected");
        } else {
            const formattedDate = await convertToFormattedDate(dateObject);
            console.log('Selected End Date as Date object:', dateObject);
            await localStorage.setItem('endDateFilterVal', formattedDate);
            window.location.reload();
        }
    
        // You can perform further actions using the selected date here
    });

    $('.exchangeRateOption-btn').on('click', async function() {
        const selectedCurrency = $(this).val();
        await localStorage.setItem('selectedCurrencyCode-'+uid, selectedCurrency);
        window.location.reload();
    });
}