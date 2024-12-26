import { uid } from "../../../main.js";
import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";

export  let accountUsers = [];
        let index = null;
        let selectedPrimaryUserVal = null;

export async function launchPrimaryUserPicker(){
    setTimeout(async ()=>{

        accountUsers.push(currentUserDataVal);
        coUsersDataVal.forEach(async(coUserData)=>{
            
            accountUsers.push(coUserData)
        });
    
        console.log(accountUsers)
        await loadUserAccountSelections();
    }, 1000);
}

async function loadUserAccountSelections() {
    // Loop through each user and create an HTML element for them
    Object.values(accountUsers).forEach(async (user, index) => {
        console.log('here', index);
        const fname = user.fname;
        const lname = user.lname;
        const html = `
            <a href="javascript:void(0)" class="iq-sub-card mb-2 mr-4 rounded pr-4 userAccountBTN" index="${index}">
                <div class="media align-items-center">
                    <div class="">
                        <img class="avatar-40 rounded" src="../../../view/images/logo.png" alt="">
                    </div>
                    <div class="media-body ml-2">
                        <h6 class="mb-0 ">${fname}</h6>
                        <small class="float-left font-size-12">${lname}</small>
                    </div>
                </div>
            </a>`;
        
        // Append the generated HTML to the container
        $('#userAccount-container').append(html);
    });

    // Add click event listener to each user account button
    $('.userAccountBTN').click(async function(e) {
        e.preventDefault();

        // Remove the selected class from all users
        $('.userAccountBTN').removeClass('bg-success'); // This unselects everyone
        
        // Add the selected class to the clicked user
        $(this).addClass('bg-success'); // This marks the clicked user as selected

        index = $(this).attr('index');
        selectedPrimaryUserVal = accountUsers[index];
        $('#proceedBTN').removeClass('disabled');
    });

    $('#proceedBTN').click(async ()=>{
        const dataObj = accountUsers[index];
        await localStorage.setItem('primaryUserData-'+uid, JSON.stringify(dataObj));
        window.location.reload();
    });
}
