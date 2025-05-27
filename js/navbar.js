document.addEventListener('DOMContentLoaded', function() {
    var apiKey = localStorage.getItem('apikey');
    var navBar = document.getElementById('navbar');
    if (!navBar) return;

	// Remove Compare, Favourites, and Home links on manager or dashboard pages
    var path = window.location.pathname;
    if (path.includes('manager') || path.includes('dashboard')) {
        // Remove Home
        var homeLink = navBar.querySelector('a[href="index.html"]');
        if (homeLink) homeLink.parentNode.remove();

        // Remove Compare
        var compareLink = navBar.querySelector('a[href="compare.html"]');
        if (compareLink) compareLink.parentNode.remove();

        // Remove Favourites
        var favLink = navBar.querySelector('a[href="favourites.html"]');
        if (favLink) favLink.parentNode.remove();
    }

    // Only update navbar if user is logged in (not default/fake key)
    if (apiKey && apiKey !== '3a160d66562032f9') {
        // Remove login button
        var loginLink = navBar.querySelector('a[href="login.html"]');
        if (loginLink){
            var li = loginLink.parentNode;
            li.parentNode.removeChild(li);
        }

        // Remove signup button
        var signupLink = navBar.querySelector('a[href="signup.html"]');
        if (signupLink){
            var li2 = signupLink.parentNode;
            li2.parentNode.removeChild(li2);
        }

        // Add greeting
        var storedname = localStorage.getItem('name');
        if (storedname){
            var greetingLi = document.createElement('li');
            greetingLi.style.listStyleType = 'none';
            greetingLi.style.display       = 'inline-block';
            greetingLi.style.marginRight   = '1em';
            var greetSpan = document.createElement('span');
            greetSpan.textContent = 'Hello, ' + storedname + '!';
            greetSpan.style.marginRight = '1em';
            greetingLi.appendChild(greetSpan);
            navBar.insertBefore(greetingLi, navBar.firstChild);
        }

        // Add logout button
        var logoutLi = document.createElement('li');
        logoutLi.style.listStyleType = 'none';
        logoutLi.style.display       = 'inline-block';
        logoutLi.style.marginRight   = '1em';
        var logoutA = document.createElement('a');
        logoutA.href = '#';
        logoutA.textContent = 'Logout';
        logoutLi.appendChild(logoutA);
        navBar.appendChild(logoutLi);

        // Logout handler
        logoutA.addEventListener('click', function(e){
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
});