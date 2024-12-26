import { fetchCurrentUserData } from "../presenter/services/fetchCurrentUserData.js";
export let currentUserDataVal = null;

export const currentUserData = async() => {
    // localStorage?.clear();
    currentUserDataVal = await fetchCurrentUserData();
    // await loadUsersNameOnTopBar(currentUserDataVal);
}

