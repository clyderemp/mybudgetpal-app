// Function to generate sidebar HTML
function generateSidebar(activePage) {
    return `
            <div class="sidebar-content js-simplebar">
				<a class="sidebar-brand" href="../home/index.html">
					<span class="align-middle"> myBudgetPal</span>
				</a>
				<ul class="sidebar-nav">
					<li class="sidebar-header" id="leftnavbar-title">
						Welcome Back!
					</li>
                    <li class="sidebar-item ${activePage === 'home/index.html' ? 'active' : ''}">
						<a class="sidebar-link" href="../home/index.html">
              				<i class="align-middle" data-feather="sliders"></i> <span class="align-middle">Dashboard</span>
            			</a>
					</li>

                    <li class="sidebar-item ${activePage === 'home/profile.html' ? 'active' : ''}">
						<a class="sidebar-link" href="../home/profile.html">
							<i class="align-middle" data-feather="file-plus"></i> <span class="align-middle">Income Report</span>
						</a>
					</li>

					<li class="sidebar-header">
						myExpenses Assistant
					</li>
                    <li class="sidebar-item ${activePage === 'report/fixed-expense.html' ? 'active' : ''}">
						<a class="sidebar-link active" href="../report/fixed-expense.html">
							<i class="align-middle" data-feather="lock"></i> <span class="align-middle">Fixed Expenses</span>
						</a>
					</li>
                    <li class="sidebar-item ${activePage === 'report/variable-expense.html' ? 'active' : ''}">
						<a class="sidebar-link" href="../report/variable-expense.html">
							<i class="align-middle" data-feather="shopping-cart"></i> <span class="align-middle">Variable Expenses</span>
						</a>
					</li>

					<li class="sidebar-header">
						mySavings Assistant
					</li>
                    <li class="sidebar-item ${activePage === 'report/savings.html' ? 'active' : ''}">
						<a class="sidebar-link" href="../report/savings.html">
							<i class="align-middle" data-feather="dollar-sign"></i> <span class="align-middle">Savings Account</span>
						</a>
					</li>

                    <li class="sidebar-item ${activePage === 'home' ? 'active' : ''}">
						<a class="sidebar-link" href="#">
							<i class="align-middle" data-feather="bar-chart"></i> <span class="align-middle">Stocks & Investments</span>
						</a>
					</li>

					<li class="sidebar-header">
						myCredit Assistant
					</li>
                    <li class="sidebar-item ${activePage === 'report/credit card.html' ? 'active' : ''}">
						<a class="sidebar-link" href="../report/credit card.html">
							<i class="align-middle" data-feather="credit-card"></i> <span class="align-middle">Credit Cards</span>
						</a>
					</li>
					<li>
						<a class="sidebar-link" href="#">
							<i class="align-middle" data-feather="briefcase"></i> <span class="align-middle">Loans</span>
						</a>
					</li>
					<li class="sidebar-header">
						myOthers Assistant
					</li>
                    <li class="sidebar-item ${activePage === 'home' ? 'active' : ''}">
						<a class="sidebar-link" href="#">
							<i class="align-middle" data-feather="shopping-bag"></i> <span class="align-middle">ShopWiz</span>
						</a>
					</li>
				</ul>

				<div class="sidebar-cta">
					<div class="sidebar-cta-content">
						<strong class="d-inline-block mb-2">Got a feedback?</strong>
						<div class="mb-3 text-sm">
							Please send us any feedback regarding this site's services and performance. Thank you!
						</div>
						<div class="d-grid">
							<a href="upgrade-to-pro.html" class="btn btn-primary">Submit feedback!</a>
						</div>
					</div>
				</div>
			</div>
    `;
}

// Function to render the sidebar in the page
function renderSidebar(activePage, loadHeaderComponent, showHeaderText) {
    const sidebarContainer = document.getElementById('sidebar-container');
    sidebarContainer.innerHTML = generateSidebar(activePage?.toLowerCase().replaceAll('%20',' '));

	// Call the function to load the navbar
    if(showHeaderText){
        let leftText, rightText;
        switch(activePage?.toLowerCase().replaceAll('%20',' ')){
            case 'home/index.html':
                leftText = 'Home'
                rightText = 'Dashboard'
                break;
            case 'admin/index.html':
                leftText = 'Administration'
                rightText = 'Dashboard'
                break;
            case 'organizations/index.html':
                leftText = 'Organizations'
                rightText = 'Dashboard'
                break;
            case 'service providers':
                leftText = 'Service Providers'
                rightText = 'Dashboard'
                break;
            default:
                leftText = 'Hi'
                rightText = 'User!'
                break;
        }
        loadHeaderComponent(leftText, rightText); // Customize the title as needed

    }
}

export function loadNavbar() {
	console.log('here')
	$('#header-title-container').html('bsdbjsa')
    // fetch('../reusables/topbar-component.html')  // Path to the navbar HTML file
    //     .then(response => response.text())
    //     .then(data => {
    //         document.getElementById('navbar-container').innerHTML = data;
    //         // Optionally, you can initialize Feather icons after loading the navbar
    //         feather.replace(); // Ensure you have Feather Icons included in your project
    //     })
    //     .catch(error => console.error('Error loading the navbar:', error));

	// fetch('../reusables/header-component.html')  // Path to the navbar HTML file
    //     .then(response => response.text())
    //     .then(data => {
	// 		console.log(data)
	// 		$('#header-title-container').html(data);
    //         // document.getElementById('header-title-container').innerHTML = data;
    //         // Optionally, you can initialize Feather icons after loading the navbar
    //         feather.replace(); // Ensure you have Feather Icons included in your project
    //     })
    //     .catch(error => console.error('Error loading the navbar:', error));
}

// Export the function to be used in other files
export { renderSidebar };