import { fetchCoUsersData } from "../presenter/services/fetchCoUsersData.js";
export let coUsersDataVal = [];

export const coUsersData = async() => {
    // localStorage?.clear();
    coUsersDataVal = await fetchCoUsersData();
    // loadCoUsersOntoTopBarNav(coUsersDataVal)
}
