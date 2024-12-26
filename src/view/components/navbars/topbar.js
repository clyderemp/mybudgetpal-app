import { uid } from "../../../../main.js";
import { coUsersDataVal } from "../../../model/coUsersData.js";
import { currentUserDataVal } from "../../../model/currentUserData.js";
import { convertToFormattedDate } from "../../../presenter/APIs/dateFormatters.js";

export let selectedPrimaryUserVal = null;

export async function topbarActionHandlers(){
    selectedPrimaryUserVal = JSON.parse(await localStorage.getItem('primaryUserData-'+uid));
    if(selectedPrimaryUserVal !== null){
        await loadUsersNameOnTopBar(selectedPrimaryUserVal);
    }
    await loadCoUsersOntoTopBarNav();
    
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


async function loadCoUsersOntoTopBarNav(){
    let accountUsers = [];
    const all = {
        lname: 'All Users',
    }
    accountUsers.push(all);
    accountUsers.push(currentUserDataVal);
    coUsersDataVal?.forEach(coUser => {
        accountUsers.push(coUser);
    });

    $('#coUser-totalVal').text(accountUsers?.length);

    accountUsers?.forEach(async(coUser, index) => {
        const fname = coUser?.fname !== undefined ? coUser?.fname : '';
        const lname = coUser?.lname !== undefined ? coUser?.lname : '';
        const fullName = fname+' '+lname;
        const dob = coUser?.dob !== undefined ? 'DOB: '+coUser?.dob : '';
        const html = `<a href="javascript:void(0);" class="iq-sub-card userAccountBTN" index="${index}">
                        <div class="media align-items-center">
                            <div class="">
                                <img class="avatar-40 rounded" src="../../images/logo.png" alt="">
                            </div>
                            <div class="media-body ml-3">
                                <h6 class="mb-0 ">${fullName}</h6>
                                <small class="float-left font-size-12">${dob}</small>
                            </div>
                        </div>
                    </a>`
        $('#coUsersNavTab').append(html);
    });

    
    // Add click event listener to each user account button
    $('.userAccountBTN').click(async function(e) {
        e.preventDefault();

        // Remove the selected class from all users
        $('.userAccountBTN').removeClass('bg-success'); // This unselects everyone
        
        // Add the selected class to the clicked user
        $(this).addClass('bg-success'); // This marks the clicked user as selected

        const index = $(this).attr('index');

        const dataObj = accountUsers[index];
        await localStorage.setItem('primaryUserData-'+uid, JSON.stringify(dataObj));
        window.location.reload();
    });
}

const loadUsersNameOnTopBar = async (primaryUser) => {
    const fullName = primaryUser?.lname === 'All Users' ? primaryUser?.lname : primaryUser?.fname +' '+primaryUser?.lname;
    $('#currentUserFullName').text(fullName);
    $('#greetings-topbar').text(primaryUser?.lname !== 'All Users' ? `Hi ${primaryUser?.fname} ${primaryUser?.lname[0]}. !` : 'Hi User!');
    $('#dob-topbar').text(primaryUser?.dob !== undefined ? `DOB: ${primaryUser?.dob}` : '');
    $('#sidebar-fname').text(primaryUser?.lname !== 'All Users' ? 'Welcome '+primaryUser?.fname+'!' : 'Welcome Budget Pal!');
    const createdOn = currentUserDataVal?.creationDate;
    $('#memberSince').text(`Member since ${createdOn}`);
}