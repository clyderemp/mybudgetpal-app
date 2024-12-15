import { uid } from "../../../main.js";
import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";
import { saveDocument } from "../services/saveDocument.js";
import { currencySymbol, currentExchangeRateVal } from "./currencyConverter.js";
import { generateTransactionID } from "./IDGenerators.js";
import { allUserReporters, categories, types } from "./invoiceForm.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

export let transactionID = null;
let userOptions = [];
let totalBudget = {};
let totalSalary = {};
export async function launchBudgetPlanForm(){
    launchUsersSalaryForm();
    launchBudgetCategorySection();
    launchBudgetTableSection();
}

async function launchUsersSalaryForm() {
    $('#usersSalaryInput').empty();
    const primaryUser = `${currentUserDataVal?.fname}`;
    totalSalary[primaryUser] = 0;
    userOptions.push(primaryUser);
    totalSalary.both = 0;

    // HTML for the primary user's salary form
    const html = `
        <div class="col-md-6 mb-3">
            <label for="budgetSalary-${primaryUser}-day">${primaryUser}'s Salary Day and Frequency:</label>
            <div class="form-row">
                <!-- Day Input (1-31) -->
                <div class="col-md-6">
                    <select class="form-control" id="budgetSalary-${primaryUser}-day" required>
                        <option value="" disabled selected>Select Day</option>
                        ${Array.from({ length: 31 }, (_, i) => i + 1).map(day => 
                            `<option value="${day}">${day} of every month</option>`
                        ).join('')}
                    </select>
                </div>
                <!-- Frequency Input -->
                <div class="col-md-6">
                    <select class="form-control" id="budgetSalary-${primaryUser}-frequency" required>
                        <option value="" disabled selected>Select Frequency</option>
                        <option value="monthly">Monthly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
            </div>
            <div class="input-group mt-2">
                <span class="input-group-text" id="budgetSalary-${primaryUser}-currency">${currencySymbol}</span>
                <input type="number" class="form-control" id="budgetSalary-${primaryUser}-amount" aria-describedby="inputGroupPrepend" required>
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

    // Add event listener for primary user's salary amount change
    $(`#budgetSalary-${primaryUser}-amount`).on('input', function() {
        const salaryAmount = parseFloat($(this).val()) || 0;  // Get the salary value, default to 0 if invalid
        totalSalary[primaryUser] = salaryAmount;  // Update totalSalary object
        console.log(`Total Salary for ${primaryUser}: ${totalSalary[primaryUser]}`);  // For debugging
    });

    // Now loop over co-users (if applicable) to generate similar inputs for them
    coUsersDataVal?.forEach(coUser => {
        const coUserName = coUser?.fname;
        userOptions.push(coUserName);
        const coUserInputListenerID = coUserName?.replaceAll(' ','');
        totalSalary[coUserInputListenerID] = 0;
        // HTML for co-user's salary form
        const coUserHtml = `
            <div class="col-md-6 mb-3">
                <label for="budgetSalary-${coUserName}-day">${coUserName}'s Salary Day and Frequency:</label>
                <div class="form-row">
                    <!-- Day Input (1-31) -->
                    <div class="col-md-6">
                        <select class="form-control" id="budgetSalary-${coUserName}-day" required>
                            <option value="" disabled selected>Select Day</option>
                            ${Array.from({ length: 31 }, (_, i) => i + 1).map(day => 
                                `<option value="${day}">${day} of every month</option>`
                            ).join('')}
                        </select>
                    </div>
                    <!-- Frequency Input -->
                    <div class="col-md-6">
                        <select class="form-control" id="budgetSalary-${coUserName}-frequency" required>
                            <option value="" disabled selected>Select Frequency</option>
                            <option value="monthly">Monthly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="weekly">Weekly</option>
                        </select>
                    </div>
                </div>
                <div class="input-group mt-2">
                    <span class="input-group-text" id="budgetSalary-${coUserName}-currency">${currencySymbol}</span>
                    <input type="number" class="form-control" id="budgetSalary-${coUserInputListenerID}-amount" aria-describedby="inputGroupPrepend" required>
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

        // Add event listener for co-user's salary amount change
        $(`#budgetSalary-${coUserInputListenerID}-amount`).on('input', function() {
            const salaryAmount = parseFloat($(this).val()) || 0;  // Get the salary value, default to 0 if invalid
            totalSalary[coUserInputListenerID] = salaryAmount;  // Update totalSalary object
            console.log(`Total Salary for ${coUserName}: ${totalSalary[coUserInputListenerID]}`);  // For debugging
        });
    });
}


async function launchBudgetCategorySection() {
    // Empty the previous content inside the target container
    $('#categoryPercentInput').empty();

    // Calculate the vertical alignment based on the number of categories
    const filteredCategories = categories.filter(category => category !== 'income');
    const verticalAlignment = 12 / filteredCategories?.length;

    filteredCategories?.forEach(async (category) => {
        totalBudget[category] = 0; // Initialize totalBudget for each category

        // Generate the HTML for each category input
        const html = `
            <div class="col-md-${verticalAlignment} mb-3">
                <label for="budgetForm-${category}-amount">${await capitalEachFirstLetter(category)}</label>
                <div class="input-group">
                    <input type="number" class="form-control" id="budgetForm-${category}-amount" aria-describedby="inputGroupPrepend" required>
                    <div class="input-group-prepend">
                        <span class="input-group-text">%</span>
                    </div>
                    <div class="invalid-feedback">
                        Please enter a valid amount.
                    </div>
                </div>
            </div>
        `;

        // Append the category input to the container
        $('#categoryPercentInput').append(html);

        // Bind the input change event for each category input
        $(`#budgetForm-${category}-amount`).on('input', function() {
            const amount = parseFloat($(this).val()) || 0; // Get the amount or default to 0
            totalBudget[category] = amount/100; // Update the totalBudget for this category

            // Optional: Do something with totalBudget, e.g., update UI or calculate totals
            console.log(totalBudget);
        });
    });
}


async function launchBudgetTableSection() {
    // Reset the content and rowIndex when modal is opened
    $('#budgetTableInput').empty();

    // Reset rowIndex each time the modal is opened
    let rowIndex = 1;
    let userOptionsHTML = '';
    userOptions.push('both');
    // Loop through categories to generate category options
    for (const user of userOptions || []) {
        userOptionsHTML += `<option value="${user}">${await capitalEachFirstLetter(user)}</option>`;
    }

    let categoryOptionsHTML = '';

    // Loop through categories to generate category options
    for (const category of categories || []) {
        if(category !== 'income'){
            categoryOptionsHTML += `<option value="${category}">${await capitalEachFirstLetter(category)}</option>`;
        }
    }
    

    // HTML structure for the initial row
    const html = `
        <div class="col-md-12 mb-3" id="budget-row-${rowIndex}">
            <label for="budgetTable-category-${rowIndex}">Budget Plan:</label>
            <div class="form-row" id="form-row-${rowIndex}">
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

    // Append the initial row to the DOM
    $('#budgetTableInput').append(html);

    // Add the "Add Another Row" button below the row
    $('#budgetTableInput').append(`
        <button type="button" class="btn btn-primary w-50" style="margin-left: 25%;" id="addBudgetRowBtn">Add New Rows</button>
    `);

    // Bind events for the first row
    bindCategoryChangeEvent(rowIndex);
    bindAmountInputEvent(rowIndex);

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
                <div class="form-row" id="form-row-${rowIndex}">
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
        bindCategoryChangeEvent(rowIndex);
        bindAmountInputEvent(rowIndex);

        // Re-add the "Add Another Row" button below the new row
        // $('#budgetTableInput').append(`
        //     <button type="button" class="btn btn-primary" id="addBudgetRowBtn">Add Another Row</button>
        // `);
    });
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
    });

    // Trigger change on the category select to load types for the initially selected category
    $(`#budgetTable-category-${index}`).trigger('change');
}


// Function to bind the amount input event for percentage calculation
function bindAmountInputEvent(index) {
    $(`#budgetTable-amount-${index}`).on('input', function() {
        let totalSalaryForBoth = 0;
        totalSalary.both = 0;
        for(const user in totalSalary){
            const salary = totalSalary[user];
            totalSalaryForBoth += salary;
        }
        totalSalary.both = totalSalaryForBoth;
        console.log(totalSalary)
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
            const totalAmount = (amount / (userSalary * categoryValue)).toFixed(2) * 100;
            const percentage = totalAmount.toFixed(2);
            
            // Update the percentage display next to the amount input field
            $(`#budgetTable-amount-${index}`).next().text(`= ${percentage} %`);
        } else {
            // Clear the percentage display if the form is invalid
            $(`#budgetTable-amount-${index}`).next().text('= 0.00 %');
        }
    });
    
}