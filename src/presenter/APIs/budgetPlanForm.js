import { uid } from "../../../main.js";
import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";
import { saveDocument, updateDocument } from "../services/saveDocument.js";
import { currencySymbol, currentExchangeRateVal, selectedCurrencyCode } from "./currencyConverter.js";
import { generateTransactionID } from "./IDGenerators.js";
import { allUserReporters, categories, types } from "./invoiceForm.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

export let transactionID = null;
let userOptions = [];
let totalBudget = {};
let totalSalary = {};
let budgetPlanData = currentUserDataVal?.budgetPlanData;
export async function launchBudgetPlanForm(){
    budgetPlanData = currentUserDataVal?.budgetPlanData;
    totalBudget = budgetPlanData?.categoryPercent || {expenses: 0, savings: 0, credit: 0};
    launchUsersSalaryForm();
    launchBudgetCategorySection();
    launchBudgetTableSection();
}

async function launchUsersSalaryForm() {
    userOptions = [];
    $('#usersSalaryInput').empty();
    const primaryUser = `${currentUserDataVal?.fname}`;
    const existingSalaryData = budgetPlanData?.userSalary;
    totalSalary[primaryUser] = existingSalaryData[0].amount * currentExchangeRateVal || 0;
    userOptions.push(primaryUser);
    totalSalary.both = 0;
    // HTML for the primary user's salary form
    const html = `
        <div class="col-md-6 mb-3">
            <label for="budgetSalary-${primaryUser}-day">${primaryUser}'s Salary Day and Frequency:</label>
            <div class="form-row">
                <!-- Day Input (1-31) -->
                <div class="col-md-6">
                    <select class="form-control ${existingSalaryData[0] ? 'is-valid' : 'is-invalid'}" id="budgetSalary-${primaryUser}-day" required>
                        <option value="" disabled selected>Select Day</option>
                        ${Array.from({ length: 31 }, (_, i) => i + 1).map(day => 
                            `<option value="${day}">${day} of every month</option>`
                        ).join('')}
                    </select>
                </div>
                <!-- Frequency Input -->
                <div class="col-md-6">
                    <select class="form-control ${existingSalaryData[0] ? 'is-valid' : 'is-invalid'}" id="budgetSalary-${primaryUser}-frequency" required>
                        <option value="" disabled selected>Select Frequency</option>
                        <option value="monthly">Monthly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
            </div>
            <div class="input-group mt-2">
                <span class="input-group-text ${existingSalaryData[0] ? 'is-valid' : 'is-invalid'}" id="budgetSalary-${primaryUser}-currency">${selectedCurrencyCode}</span>
                <input type="number" class="form-control ${existingSalaryData[0] ? 'is-valid' : 'is-invalid'}" id="budgetSalary-${primaryUser}-amount" aria-describedby="inputGroupPrepend" required>
            </div>
            <div class="valid-feedback">
                Looks good!
            </div>
            <div class="invalid-feedback">
                Please select a day and frequency.
            </div>
        </div>
    `;
    $('#usersSalaryInput').append(html);
    $(`#budgetSalary-${primaryUser}-day`).val(existingSalaryData[0]?.day);
    $(`#budgetSalary-${primaryUser}-frequency`).val(existingSalaryData[0]?.frequency);
    $(`#budgetSalary-${primaryUser}-amount`).val(existingSalaryData[0]?.amount * currentExchangeRateVal);

    // Add event listener for primary user's salary amount change
    $(`#budgetSalary-${primaryUser}-amount`).on('input', async function() {

        const salaryAmount = parseFloat($(this).val());  // Get the salary value, default to 0 if invalid
        totalSalary[primaryUser] = salaryAmount;  // Update totalSalary object
        if(salaryAmount >= 0){
            $(this).removeClass('is-invalid');
        }
        // await calculatePercentage(index);
    });

    // Now loop over co-users (if applicable) to generate similar inputs for them
    coUsersDataVal?.forEach(async(coUser, index) => {
        const coUserName = coUser?.fname;
        userOptions.push(coUserName);
        const coUserInputListenerID = coUserName?.replaceAll(' ','');
        totalSalary[coUserInputListenerID] = existingSalaryData[index+1].amount * currentExchangeRateVal || 0;
        // HTML for co-user's salary form
        const coUserHtml = `
            <div class="col-md-6 mb-3">
                <label for="budgetSalary-${coUserName}-day">${coUserName}'s Salary Day and Frequency:</label>
                <div class="form-row">
                    <!-- Day Input (1-31) -->
                    <div class="col-md-6">
                        <select class="form-control ${existingSalaryData[index+1] ? 'is-valid' : 'is-invalid'}" id="budgetSalary-${coUserInputListenerID}-day" required>
                            <option value="" disabled selected>Select Day</option>
                            ${Array.from({ length: 31 }, (_, i) => i + 1).map(day => 
                                `<option value="${day}">${day} of every month</option>`
                            ).join('')}
                        </select>
                    </div>
                    <!-- Frequency Input -->
                    <div class="col-md-6">
                        <select class="form-control ${existingSalaryData[index+1] ? 'is-valid' : 'is-invalid'}" id="budgetSalary-${coUserInputListenerID}-frequency" required>
                            <option value="" disabled selected>Select Frequency</option>
                            <option value="monthly">Monthly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                </div>
                <div class="input-group mt-2">
                    <span class="input-group-text" id="budgetSalary-${coUserInputListenerID}-currency">${selectedCurrencyCode}</span>
                    <input type="number" class="form-control ${existingSalaryData[index+1] ? 'is-valid' : 'is-invalid'}" aria-describedby="inputGroupPrepend" id="budgetSalary-${coUserInputListenerID}-amount" required>
                </div>
                <div class="valid-feedback">
                    Looks good!
                </div>
                <div class="invalid-feedback">
                    Please select a day and frequency.
                </div>
            </div>
        `;
        $('#usersSalaryInput').append(coUserHtml);
        $(`#budgetSalary-${coUserInputListenerID}-day`).val(existingSalaryData[index+1].day);
        $(`#budgetSalary-${coUserInputListenerID}-frequency`).val(existingSalaryData[index+1].frequency);
        $(`#budgetSalary-${coUserInputListenerID}-amount`).val(existingSalaryData[index+1].amount * currentExchangeRateVal);

        // Add event listener for co-user's salary amount change
        $(`#budgetSalary-${coUserInputListenerID}-amount`).on('input', function() {
            const salaryAmount = parseFloat($(this).val());  // Get the salary value, default to 0 if invalid
            totalSalary[coUserInputListenerID] = salaryAmount;  // Update totalSalary object
            if(salaryAmount >= 0){
                $(this).removeClass('is-invalid');
            }
        });
    });
}

async function launchBudgetCategorySection() {
    const categoryPercentData = budgetPlanData?.categoryPercent;
    totalBudget = categoryPercentData;
    // Empty the previous content inside the target container
    $('#categoryPercentInput').empty();

    // Initialize a variable to track the total percentage sum
    let totalPercentage = 0;

    // Calculate the vertical alignment based on the number of categories
    const filteredCategories = categories.filter(category => category !== 'income');
    const verticalAlignment = 12 / filteredCategories?.length;

    filteredCategories?.forEach(async (category) => {

        // Generate the HTML for each category input
        const html = `
            <div class="col-md-${verticalAlignment} mb-3">
                <label for="budgetForm-${category}-amount">${await capitalEachFirstLetter(category)}</label>
                <div class="input-group">
                    <input type="number" class="form-control ${categoryPercentData[category] > 0 ? 'is-valid' : 'is-invalid'}" id="budgetForm-${category}-amount" aria-describedby="inputGroupPrepend" required>
                    <div class="input-group-prepend">
                        <span class="input-group-text">%</span>
                    </div>
                    <div class="invalid-feedback" hidden>
                        Total percentage cannot exceed 100%.
                    </div>
                </div>
            </div>
        `;

        // Append the category input to the container
        $('#categoryPercentInput').append(html);
        $(`#budgetForm-${category}-amount`).val(categoryPercentData[category])

        // Bind the input change event for each category input
        $(`#budgetForm-${category}-amount`).on('input', async function() {
            const amount = parseFloat($(this).val()) || 0; // Get the amount or default to 0
            totalBudget[category] = amount; // Update the totalBudget for this category
            
            // Calculate the total percentage of all category inputs
            totalPercentage = Object.values(totalBudget).reduce((sum, value) => sum + value, 0);
            
            // Check if the total percentage exceeds 100
            if (totalPercentage > 100) {
                // $(this).addClass('is-invalid'); // Add 'is-invalid' class if total exceeds 100
                $(this).next('.invalid-feedback').text('Total percentage cannot exceed 100%.'); // Update error message
            } else {
                $(this).removeClass('is-invalid'); // Remove 'is-invalid' if the input is valid
                $(this).next('.invalid-feedback').text(''); // Clear the error message
            }
        });
    });
}



async function launchBudgetTableSection() {

    const budgetPlanArrayData = budgetPlanData?.budgetPlanArray;
    // Reset the content and rowIndex when modal is opened
    $('#budgetTableInput').empty();
    // Reset rowIndex each time the modal is opened
    let rowIndex = budgetPlanArrayData?.length-1 || 0;
    let userOptionsHTML = '';
    let categoryOptionsHTML = '';
    let typeOptionsHTML = '';
    const headerHTML = '<label class="ml-2" for="budgetTable-category-${index}">Budget Plan:</label>'
    $('#budgetTableInput').append(headerHTML);
    budgetPlanArrayData?.forEach(async(data, index) => {

        if(!userOptions.includes('both')){
            userOptions.push('both');
        }
        // Loop through categories to generate category options
        for (const user of userOptions || []) {
            userOptionsHTML += `<option value="${user}">${await capitalEachFirstLetter(user)}</option>`;
        }
    
        // Loop through categories to generate category options
        for (const category of categories || []) {
            if(category !== 'income'){
                categoryOptionsHTML += `<option value="${category}">${await capitalEachFirstLetter(category)}</option>`;
            }
        }
        let typeArray = [];
        if(data?.category){

            typeArray = types[data?.category] || [];
            // Loop through categories to generate category options
            for (const typeVal of typeArray || []) {
                console.log(typeVal)
                typeOptionsHTML += `<option value="${typeVal}">${await capitalEachFirstLetter(typeVal)}</option>`;
            }
        }

        const categoryValue = totalBudget[data.category]/100 || 0;
        const totalAmount = ((data.amount * currentExchangeRateVal) / ((totalSalary[(data.user)?.replaceAll(' ','')]) * categoryValue)) * 100;
        const percentage = totalAmount.toFixed(2);
    
        // HTML structure for the initial row
        const html = `
            <div class="col-md-12 mt-3" id="budget-row-${index}">
                <div class="form-row budget-row" id="form-row-${index}">
                    <div class="col-md-2">
                        <select class="form-control budgetTable-users" id="budgetTable-users-${index}" required>
                            ${userOptionsHTML}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-control budgetTable-category" id="budgetTable-category-${index}" required>
                            ${categoryOptionsHTML}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select class="form-control budgetTable-type" id="budgetTable-type-${index}" value="Rent"required>
                            ${typeOptionsHTML}dfcghvbj
                        </select>
                    </div>
                    <div class="col-md-5">
                        <div class="input-group-prepend">
                            <span class="input-group-text">${currencySymbol}</span>
                            <input type="number" class="form-control budgetTable-amount" id="budgetTable-amount-${index}" aria-describedby="inputGroupPrepend" required>
                            <span class="input-group-text"> = ${percentage} % of ${data.user}'s budget</span>
                        </div>
                    </div>
                </div>
                <div class="invalid-feedback">
                    Please select a valid category.
                </div>
            </div>
        `;
    
        // Append the initial row to the DOM
        console.log(data.type)
        $('#budgetTableInput').append(html);
        $(`#budgetTable-users-${index}`).val(data.user);
        $(`#budgetTable-category-${index}`).val(data.category);
        $(`#budgetTable-type-${index}`).val(data.type);
        $(`#budgetTable-amount-${index}`).val(data.amount * currentExchangeRateVal);


        // Bind events for the first row
        bindUserChangeEvent(index);
        $(`#budgetTable-category-${index}`).on('change', async function() {
            const selectedCategory = $(this).val();
            const typeArray = types[selectedCategory] || [];
            let typeOptionsHTML = '';
    
            // Loop through types for the selected category and generate options
            for (const type of typeArray) {
                typeOptionsHTML += `<option value="${type}">${await capitalEachFirstLetter(type)}</option>`;
            }
    
            // Update the type dropdown with the new options
            $(`#budgetTable-type-${index}`).html(typeOptionsHTML);
    
            // Check if the current category has an 'is-invalid' class
            if ($(`#budgetTable-category-${index}`).hasClass('is-invalid')) {
                // Remove 'is-invalid' from the previous category if it exists
                $(`#budgetTable-category-${index}`).removeClass('is-invalid');
                // Clear the feedback message
                $(`#budgetTable-category-${index}`).next().text('');
            }
    
            const selectedUser = ($(`#budgetTable-users-${index}`).val())?.replaceAll(' ', '');
            // Get the user's total salary from the `totalSalary` object
            const userSalary = totalSalary[selectedUser] || 0;
            
            // Get the category value from the `totalBudget` object
            const categoryValue = totalBudget[selectedCategory] || 0;
            
            // Get the amount entered in the input field
            const amount = parseFloat($(this).val()) || 0;
            
            // Validate inputs
            let isValid = true;
            
            // Check if any of the fields are missing or invalid
            if (!selectedUser || !selectedCategory || !userSalary || !categoryValue ) {
                isValid = false;
                
                // Add the 'is-invalid' class to the fields to highlight them as invalid
                $(`#budgetSalary-${selectedUser}-amount`).addClass('is-invalid');
                $(`#budgetForm-${selectedCategory}-amount`).addClass('is-invalid');
                
                // Display an invalid feedback message (optional)
            } 
        });
        // bindAmountInputEvent(index);
    });

    // Add the "Add Another Row" button below the row
    $('#budgetTableInput').append(`
        <button type="button" class="btn btn-primary w-25 mb-6" style="margin-left: 65%;" id="addBudgetRowBtn">Add New Rows</button>
    `);

    // Function to dynamically add another row
    $('#addBudgetRowBtn').on('click', function() {
        // Remove the button from its previous position
        // $(this).remove();

        // Increment rowIndex for the new row
        rowIndex++;

        // Create new row HTML with the updated rowIndex
        let newRowHTML = `
            <div class="col-md-12 mb-3" id="budget-row-${rowIndex}">
                <hr class="mt-1 mb-3">
                <div class="form-row budget-row" id="form-row-${rowIndex}">
                    <div class="col-md-2">
                        <select class="form-control budgetTable-users" id="budgetTable-users-${rowIndex}" required>
                            ${userOptionsHTML}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <select class="form-control budgetTable-category" id="budgetTable-category-${rowIndex}" required>
                            ${categoryOptionsHTML}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select class="form-control budgetTable-type" id="budgetTable-type-${rowIndex}" required>
                            <!-- Types will be dynamically loaded based on selected category -->
                        </select>
                    </div>
                    <div class="col-md-5">
                        <div class="input-group-prepend">
                            <span class="input-group-text">${currencySymbol}</span>
                            <input type="number" class="form-control budgetTable-amount" id="budgetTable-amount-${rowIndex}" aria-describedby="inputGroupPrepend" required>
                            <span class="input-group-text"> = 0.00 %</span>
                        </div>
                    </div>
                </div>
                <div class="invalid-feedback">
                    Please select a valid category.
                </div>
            </div>
        `;

        // Append the new row inside the budget table input
        $('#budgetTableInput').append(newRowHTML);

        // Rebind events for the new row
        bindUserChangeEvent(rowIndex);
        bindCategoryChangeEvent(rowIndex);
        bindAmountInputEvent(rowIndex);

        // Re-add the "Add Another Row" button below the new row
        // $('#budgetTableInput').append(`
        //     <button type="button" class="btn btn-primary" id="addBudgetRowBtn">Add Another Row</button>
        // `);
    });
}

// Function to bind users change event
function bindUserChangeEvent(index) {
    $(`#budgetTable-users-${index}`).on('change', async function() {
        const selectedUser = ($(this).val())?.replaceAll(' ', '');
        const selectedCategory = $(`#budgetTable-category-${index}`).val();
        const typeArray = types[selectedCategory] || [];
        let typeOptionsHTML = '';

        // Loop through types for the selected category and generate options
        for (const type of typeArray) {
            typeOptionsHTML += `<option value="${type}">${await capitalEachFirstLetter(type)}</option>`;
        }

        // Update the type dropdown with the new options
        $(`#budgetTable-type-${index}`).html(typeOptionsHTML);

        // Check if the current category has an 'is-invalid' class
        if ($(`#budgetTable-category-${index}`).hasClass('is-invalid')) {
            // Remove 'is-invalid' from the previous category if it exists
            $(`#budgetTable-category-${index}`).removeClass('is-invalid');
            // Clear the feedback message
            $(`#budgetTable-category-${index}`).next().text('');
        }

        // Get the user's total salary from the `totalSalary` object
        const userSalary = totalSalary[selectedUser] || 0;
        
        // Get the category value from the `totalBudget` object
        const categoryValue = totalBudget[selectedCategory] || 0;
        
        // Get the amount entered in the input field
        const amount = parseFloat($(this).val()) || 0;
        
        // Validate inputs
        let isValid = true;
        
        // Check if any of the fields are missing or invalid
        if (!selectedUser || !selectedCategory || !userSalary || !categoryValue ) {
            isValid = false;
            
            // Add the 'is-invalid' class to the fields to highlight them as invalid
            $(`#budgetSalary-${selectedUser}-amount`).addClass('is-invalid');
            $(`#budgetForm-${selectedCategory}-amount`).addClass('is-invalid');
            
            // Display an invalid feedback message (optional)
        } 
    });

    // Trigger change on the category select to load types for the initially selected category
    $(`#budgetTable-category-${index}`).trigger('change');
}

// Function to bind category change event
function bindCategoryChangeEvent(index) {
    $(`#budgetTable-category-${index}`).on('change', async function() {
        const selectedCategory = $(this).val();
        const typeArray = types[selectedCategory] || [];
        let typeOptionsHTML = '';

        // Loop through types for the selected category and generate options
        for (const type of typeArray) {
            typeOptionsHTML += `<option value="${type}">${await capitalEachFirstLetter(type)}</option>`;
        }

        // Update the type dropdown with the new options
        $(`#budgetTable-type-${index}`).html(typeOptionsHTML);

        // Check if the current category has an 'is-invalid' class
        if ($(`#budgetTable-category-${index}`).hasClass('is-invalid')) {
            // Remove 'is-invalid' from the previous category if it exists
            $(`#budgetTable-category-${index}`).removeClass('is-invalid');
            // Clear the feedback message
            $(`#budgetTable-category-${index}`).next().text('');
        }

        const selectedUser = ($(`#budgetTable-users-${index}`).val())?.replaceAll(' ', '');
        // Get the user's total salary from the `totalSalary` object
        const userSalary = totalSalary[selectedUser] || 0;
        
        // Get the category value from the `totalBudget` object
        const categoryValue = totalBudget[selectedCategory] || 0;
        
        // Get the amount entered in the input field
        const amount = parseFloat($(this).val()) || 0;
        
        // Validate inputs
        let isValid = true;
        
        // Check if any of the fields are missing or invalid
        if (!selectedUser || !selectedCategory || !userSalary || !categoryValue ) {
            isValid = false;
            
            // Add the 'is-invalid' class to the fields to highlight them as invalid
            $(`#budgetSalary-${selectedUser}-amount`).addClass('is-invalid');
            $(`#budgetForm-${selectedCategory}-amount`).addClass('is-invalid');
            
            // Display an invalid feedback message (optional)
        } 
    });

    // Trigger change on the category select to load types for the initially selected category
    $(`#budgetTable-category-${index}`).trigger('change');
}

// Function to bind the amount input event for percentage calculation
function bindAmountInputEvent(index) {
    $(`#budgetTable-amount-${index}`).on('input', async function() {
        let totalSalaryForBoth = 0;
        totalSalary.both = 0;
        for(const user in totalSalary){
            const salary = totalSalary[user];
            totalSalaryForBoth += salary;
        }
        totalSalary.both = totalSalaryForBoth;
        // Get the selected user and category from the form
        const selectedUser = ($(`#budgetTable-users-${index}`).val())?.replaceAll(' ', '');
        const selectedCategory = $(`#budgetTable-category-${index}`).val();
        // Get the user's total salary from the `totalSalary` object
        const userSalary = totalSalary[selectedUser] || 0;
        
        // Get the category value from the `totalBudget` object
        const categoryValue = totalBudget[selectedCategory] || 0;
        
        // Get the amount entered in the input field
        const amount = parseFloat($(this).val()) || 0;
        
        // Validate inputs
        let isValid = true;
        // Check if any of the fields are missing or invalid
        if (!selectedUser || !selectedCategory || !userSalary || !categoryValue ) {
            isValid = false;
            
            // Add the 'is-invalid' class to the fields to highlight them as invalid
            $(`#budgetSalary-${selectedUser}-amount`).addClass('is-invalid');
            $(`#budgetForm-${selectedCategory}-amount`).addClass('is-invalid');
            
            // Display an invalid feedback message (optional)
        } else if (amount > (userSalary * categoryValue)){
            $(`#budgetTable-amount-${index}`).addClass('is-invalid');
            $(`#budgetTable-amount-${index}`).next().text('Exceeded max.').addClass('invalid-feedback');
        } else {
            // Remove 'is-invalid' class if inputs are valid
            $(`#budgetSalary-${selectedUser}-amount`).removeClass('is-invalid');
            $(`#budgetForm-${selectedCategory}-amount`).removeClass('is-invalid');
            $(`#budgetTable-amount-${index}`).removeClass('is-invalid');
            
            // Remove the invalid feedback message
            $(`#budgetTable-amount-${index}`).next().text('= 0.00 %').removeClass('invalid-feedback');
        }
        
        // If the form is valid, calculate the percentage
        if (isValid) {
            
            // Update the percentage display next to the amount input field
            await calculatePercentage(index, amount);
        } else {
            // Clear the percentage display if the form is invalid
            $(`#budgetTable-amount-${index}`).next().text('= 0.00 %');
        }
    });
    
}

async function calculatePercentage(index, amount){

    const selectedUser = ($(`#budgetTable-users-${index}`).val())?.replaceAll(' ', '');
    const selectedCategory = $(`#budgetTable-category-${index}`).val();

    // Get the user's total salary from the `totalSalary` object
    const userSalary = totalSalary[selectedUser] || 0;
    
    // Get the category value from the `totalBudget` object
    const categoryValue = totalBudget[selectedCategory]/100 || 0;
    const totalAmount = (amount / (userSalary * categoryValue)) * 100;
    const percentage = totalAmount.toFixed(2);

    $(`#budgetTable-amount-${index}`).next().text(`= ${percentage} % of ${selectedUser}'s budget`);
}

$('#budgetPlanForm').on('submit', async function(event){
    event.preventDefault();
    /**
     * SALARY
     */
    userOptions = userOptions.filter(user => user !== 'both');
    let userSalaryArray = [];
    userOptions.forEach(async(user)=>{
        const coUserInputListenerID = user.replaceAll(' ','');
        const day = $(`#budgetSalary-${coUserInputListenerID}-day`).val();
        const frequency = $(`#budgetSalary-${coUserInputListenerID}-frequency`).val();
        const amount = $(`#budgetSalary-${coUserInputListenerID}-amount`).val();
        const salaryObj = {
            frequency: frequency,
            amount: amount / currentExchangeRateVal,
            day: day
        }
        userSalaryArray.push(salaryObj);
    });

    /**
     * CATEGORIES
     */
    let categoryBudgetPercentVal = {};
    const filteredCategories = categories.filter(category => category !== 'income');
    filteredCategories?.forEach(async (category) => {
        const categoryBudgetPercent = $(`#budgetForm-${category}-amount`).val();
        categoryBudgetPercentVal[category] = parseFloat(categoryBudgetPercent);
    });
    
    /**
     * BUDGET PLAN
     */
    let budgetPlanArray = [];
    $('.budget-row').each(async function() {
        const rowIndex = $(this).attr('id').split('-')[2];  // Get the row index dynamically
        const user = $(`#budgetTable-users-${rowIndex}`).val();
        const category = $(`#budgetTable-category-${rowIndex}`).val();
        const type = $(`#budgetTable-type-${rowIndex}`).val();
        const amount = parseFloat($(`#budgetTable-amount-${rowIndex}`).val()) || 0;

        // If a valid user is selected and the amount is non-zero, save this row's data
        if (user && amount > 0) {
            const rowData = {
                user: user,
                category: category,
                type: type,
                amount: amount / currentExchangeRateVal,
            };

            // Push the row data into the array
            budgetPlanArray.push(rowData);
        }
    });

    const budgetFormDocData = {
        userSalary: userSalaryArray,
        categoryPercent: categoryBudgetPercentVal,
        budgetPlanArray: budgetPlanArray,
    };
    console.log(budgetFormDocData)
    await updateDocument('users', uid, {budgetPlanData: budgetFormDocData});
    await localStorage.removeItem('currentUserData-'+uid);
    window.location.reload();
});