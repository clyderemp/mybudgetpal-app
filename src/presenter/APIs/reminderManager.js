import { uid } from "../../../main.js";
import { budgetPlanData } from "../../model/budgetPlanData.js";
import { incomeData } from "../../model/incomeData.js"
import { predictNextSalaryDate } from "../../model/ML/salaryML.js";
import { selectedPrimaryUserVal } from "../../view/components/navbars/topbar.js";
import { calculateDaysPast, calculateDaysUntil } from "./dateFormatters.js";
import { launchReminderModal } from "./sweetAlertModals.js";

export async function launchReminderManager(){
    if(selectedPrimaryUserVal?.lname !== 'All Users'){
        await checkUserSalaryLog();
    }
}

// Function to check if salary is coming soon based on the predicted salary date
async function checkUserSalaryLog() {
    let transactions = await JSON.parse(await localStorage.getItem('transactionData-' + uid)) || [];
    const onConfirm = () => {
        $('#invoiceFormButton').click();
    };
    // Get the current date
    const currentDate =  new Date();
    // currentDate.setDate(currentDate.getDate() + ); // Add 7 days to predicted salary date
    const userSalaryBudgetData = budgetPlanData?.userSalary?.find(item => item.user === selectedPrimaryUserVal?.fname);
    // Get the day from the userSalary object (make sure it's a number)
    const salaryDay = parseInt(userSalaryBudgetData?.day, 10); // Convert to integer
    // Create a new Date object for the next occurrence of the salary day
    let nextSalaryDate;

    // Check if today's date is already past the salary day by 10 days
    if (currentDate.getDate() > salaryDay && ((currentDate.getDate() - salaryDay) > 10)) {
        // Set the date to the same day of the next month
        nextSalaryDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, salaryDay);
    } else {
        // Otherwise, set the date to the salary day in the current month
        nextSalaryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), salaryDay);
    }
    const predictedSalaryDate = (nextSalaryDate) ? nextSalaryDate : await predictNextSalaryDate(transactions);

    // Calculate the range: from predicted salary date to 7 days later
    const salaryReminderEndDate = new Date(predictedSalaryDate);
    salaryReminderEndDate.setDate(salaryReminderEndDate.getDate() + 7); // Add 7 days to predicted salary date

    const daysPriorSalaryReminderDate = new Date(predictedSalaryDate);
    daysPriorSalaryReminderDate.setDate(daysPriorSalaryReminderDate.getDate() - 3); // Add 7 days to predicted salary date

    /**
     * PROCEED WITH THE ReMINDER
     */

    // Case 1: Check if today is within the predicted salary date and the next 7 days
    if (currentDate.getDate() === predictedSalaryDate.getDate()) {
        // Check if no income has been logged in this 7-day range
        const hasLoggedIncome = transactions.some((transaction) => {
            const transactionDate = new Date(transaction.date);
            return (
                transaction.category?.toLowerCase() === 'income' &&
                transaction.type?.toLowerCase() === 'job paycheque' &&
                transactionDate >= predictedSalaryDate &&
                transactionDate <= salaryReminderEndDate
            );
        });

        // If no income logged in the 7-day window, show the reminder
        if (!hasLoggedIncome) {
            // Filter and sort income transactions to find the last one
            const incomeTransactions = transactions.filter((transaction) => {
                const user = transaction.reportedBy?.replaceAll('Me - ','');
                return (
                    transaction.category?.toLowerCase() === 'income' &&
                    transaction.type?.toLowerCase() === 'job paycheque' &&
                    user === (selectedPrimaryUserVal.fname + ' ' + selectedPrimaryUserVal.lname)
                );
            });

            // Sort the filtered income transactions to get the most recent one
            const sortedIncome = incomeTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Get the latest income date (if there is any income transaction)
            const lastIncomeDate = sortedIncome[0] ? new Date(sortedIncome[0].date).toDateString() : 'N/A';

            // Send the reminder message
            const msg = `Hey ${selectedPrimaryUserVal.fname}!<br>
                <small>Looks like your next salary is coming today!<br> Make sure you log it to keep track of your monthly income.<br>
                Your last reported income invoice was on ${lastIncomeDate}.</small>`;
            await launchReminderModal('../../images/AL.png', null, msg, null, null, onConfirm);
        }
    }

    // Case 2: Check if today is 7 days after the predicted salary date and no income has been logged
    if (predictedSalaryDate < currentDate && currentDate < salaryReminderEndDate) {
        // Check again if no income was reported after the predicted date + 7 days
        const hasLoggedIncomeAfter7Days = transactions.some((transaction) => {
            const transactionDate = new Date(transaction.date);
            return (
                transaction.category?.toLowerCase() === 'income' &&
                transaction.type?.toLowerCase() === 'job paycheque' &&
                transactionDate >= predictedSalaryDate &&
                transactionDate <= salaryReminderEndDate
            );
        });

        // If no income was reported in the 7-day range, send the reminder again
        if (!hasLoggedIncomeAfter7Days) {
            // Filter and sort income transactions to find the last one
            const incomeTransactions = transactions.filter((transaction) => {
                const user = transaction.reportedBy?.replaceAll('Me - ','');
                return (
                    transaction.category?.toLowerCase() === 'income' &&
                    transaction.type?.toLowerCase() === 'job paycheque' &&
                    user === (selectedPrimaryUserVal.fname + ' ' + selectedPrimaryUserVal.lname)
                );
            });

            // Sort the filtered income transactions to get the most recent one
            const sortedIncome = incomeTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Get the latest income date (if there is any income transaction)
            const lastIncomeDate = sortedIncome[0] ? new Date(sortedIncome[0].date).toDateString() : 'N/A';
            const daysPassed = await calculateDaysPast(currentDate, predictedSalaryDate);
            // Send the reminder message
            const msg = `Hey ${selectedPrimaryUserVal.fname}!<br>
                <small>It has been ${daysPassed} day${daysPassed === 1 ? '':'s'} and it looks like you haven't logged your income after the expected salary date on ${predictedSalaryDate.toDateString()}.<br>
                Your last reported income was on ${lastIncomeDate}. Would you like to log your income now?</small>`;
                const confirmText = 'Yes';
                const cancelText = 'No';
                await launchReminderModal('../../images/AL.png', null, msg, confirmText, cancelText, onConfirm);
        }
    }

    // Case 3: Check if today is 3-5 days before the salary date
    if (daysPriorSalaryReminderDate <= currentDate && currentDate <= predictedSalaryDate) {
        // Check again if no income was reported after the predicted date + 7 days
        const hasLoggedIncomeAfter7Days = transactions.some((transaction) => {
            const transactionDate = new Date(transaction.date);
            return (
                transaction.category?.toLowerCase() === 'income' &&
                transaction.type?.toLowerCase() === 'job paycheque' &&
                transactionDate >= predictedSalaryDate &&
                transactionDate <= salaryReminderEndDate
            );
        });

        // If no income was reported in the 7-day range, send the reminder again
        if (!hasLoggedIncomeAfter7Days) {
            // Filter and sort income transactions to find the last one
            const incomeTransactions = transactions.filter((transaction) => {
                const user = transaction.reportedBy?.replaceAll('Me - ','');
                return (
                    transaction.category?.toLowerCase() === 'income' &&
                    transaction.type?.toLowerCase() === 'job paycheque' &&
                    user === (selectedPrimaryUserVal.fname + ' ' + selectedPrimaryUserVal.lname)
                );
            });

            // Sort the filtered income transactions to get the most recent one
            const sortedIncome = incomeTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Get the latest income date (if there is any income transaction)
            const lastIncomeDate = sortedIncome[0] ? new Date(sortedIncome[0].date).toDateString() : 'N/A';

            const daysUntilSalary = await calculateDaysUntil(currentDate, predictedSalaryDate);
            // Send the reminder message
            const msg = `Hey ${selectedPrimaryUserVal.fname}!<br>
                <small>It looks like your salary is coming ${daysUntilSalary === 1 ? 'tomorrow' : `in ${daysUntilSalary} days`} on ${predictedSalaryDate.toDateString()}.<br>
                Your last reported income was on ${lastIncomeDate}.<br>Would you like to log your income now?</small>`;
            const confirmText = 'Yes';
            const cancelText = 'No';
            await launchReminderModal('../../images/AL.png', null, msg, confirmText, cancelText, onConfirm);
        }
    }
}
