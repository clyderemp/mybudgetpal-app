import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";
import { selectedPrimaryUserVal } from "../../view/components/navbars/topbar.js";
import { launchLoadingModal } from "./sweetAlertModals.js";
import { animateNumber } from "./textAnimation.js";

let accountUsers = [],
    accountUserString = '';
let userPosts = [],
    userFollowing = [],
    userFollowers = [];
const profileImgElement = $('.userProfile-img');
const headerImgElement = $('#headerImg');
const defaultProfileImg = '../../images/logo.png';
const defaultProfileHeader = '../../images/illustrations/neighborhood.jpg';

$(function(){
    launchLoadingModal();
    setTimeout(async function(){
        try{
            await fetchAllUserAccounts();
            await loadFollowersPanelData();
            await loadUserProfileImg();
            await loadBudgetStyleData();
            Swal.close();
        } catch (err){
            // window.location.reload();
        }
    },1500);
});

async function loadFollowersPanelData(){
    const data = [
        { number: 0, text: 'Posts' }, // Example data for Posts
        { number: 0, text: 'Followers' }, // Example data for Followers
        { number: 0, text: 'Following' } // Example data for Following
    ];

    // Loop through each <li> and update the content dynamically
    $('.social-data-block li').each(function(index) {
        const boxContent = data[index];
        const $numberElement = $(this).find('p');
        const $description = $(this).find('h6');

        // Set the description text
        $description.text(boxContent.text);

        // Animate the number count-up
        animateNumber($numberElement, boxContent.number, null);
    });
}

async function fetchAllUserAccounts(){
    accountUsers.push(currentUserDataVal);
    accountUserString = currentUserDataVal?.fname;
    coUsersDataVal.forEach(async(coUserData, index)=>{
        if(coUsersDataVal?.length > 3){
            accountUserString += ` & ${coUsersDataVal?.length} other users`;
        } else if(index+1 === coUsersDataVal?.length){
            accountUserString += ` & ${coUserData?.fname}`;
        } else {
            accountUserString += `, ${coUserData?.fname}`;
        }
        accountUsers.push(coUserData)
    });

    $('#accountUserString').text(accountUserString);
}

async function loadUserProfileImg(){
    $('#joinDate').text(currentUserDataVal?.creationDate);
    const userProfileImg = currentUserDataVal?.profileImg || defaultProfileImg;
    profileImgElement.attr('src', userProfileImg);
    headerImgElement.attr('src', defaultProfileHeader);
    // Set the height for the container and apply the cropping effect
    var containerHeight = 300; // Adjust this value to crop more or less

    // Apply styles to the image container and the image
    $('.image-container').css({
        'position': 'relative',
        'height': containerHeight + 'px', // Set the height of the container
        'overflow': 'hidden' // Hide the parts of the image that exceed the container
    });

    $('.image-container img').css({
        'object-fit': 'cover', // Crop the image while maintaining aspect ratio
        'width': '100%', // Make the image span the full width of the container
        'height': '100%' // Make the image span the full height of the container
    });
}

async function loadBudgetStyleData() {
    const budgetPlanData = currentUserDataVal?.budgetPlanData?.categoryPercent;

    console.log(budgetPlanData)
    const data = [
        { number: budgetPlanData?.expenses, text: 'Expenses' },
        { number: budgetPlanData?.savings, text: 'Savings' },
        { number: budgetPlanData?.credit, text: 'Credit' }
    ];

    // Loop through each box and update its content
    $('.profile-box').each(function(index) {
        const boxContent = data[index];
        const $bigNumber = $(this).find('.big-number');
        const $description = $(this).find('.description');

        // Set initial text content
        $description.text(boxContent.text);

        // Animate the number count-up
        animateNumber($bigNumber, boxContent.number, '%');
    });
}

