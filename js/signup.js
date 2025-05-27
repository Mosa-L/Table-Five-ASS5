// Description: Handles the signup form validation and submission
// This script validates the signup form, checks for errors, and submits the data to the server.
document.addEventListener('DOMContentLoaded', function (){
    var form = document.getElementById('signupForm');
    var errorEl = document.getElementById('errorMessage');
    var nameInput = document.getElementById('name');
    var surnameInput = document.getElementById('surname');
    var emailInput = document.getElementById('email');
    var passwordInput = document.getElementById('password');
    var confirmPasswordInput = document.getElementById('confirmPassword');

    form.addEventListener('submit', function(e){
        e.preventDefault();
        errorEl.textContent = ''; //clears previous error message

        var name = nameInput.value.trim();
        var surname = surnameInput.value.trim();
        var email = emailInput.value.trim();
        var password = passwordInput.value.trim();
        var confirmPassword = confirmPasswordInput.value.trim();

        if (!name || !surname || !email || !password || !confirmPassword){
            errorEl.textContent = 'Please fill in all fields.';
            return;
        }
        var emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)){
            errorEl.textContent = 'Please enter a valid email address.';
            return;
        }

        var passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{9,}$/;
        if (!passwordRegex.test(password)){
            errorEl.textContent = 'Password must be at least 9 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';
            return;
        }

        if (password !== confirmPassword){
            errorEl.textContent = 'Passwords do not match.';
            return;
        }

        var payload = {
            type: 'Register',
            name: name,
            surname: surname,
            email: email,
            password: password,
            user_type: 'Customer'
        };

        var xhr = new XMLHttpRequest();
        xhr.open('POST', './api.php', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function(){
            if (xhr.readyState !== 4){
                return;
            }
            if (xhr.status >= 200 && xhr.status < 300){
                try{
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.status === 'success'){
                        var apikey = resp.data.apikey || (resp.data[0] && resp.data[0].apikey);
                        alert('Welcome to the family! Your API key is ' + apikey);
                        localStorage.setItem('apikey', apikey);
                        window.location.href = 'index.html';
                    }
                    else{
                        errorEl.textContent = resp.data || 'Registration failed. Please try again.';
                    }
                }
                catch (err) {
                    console.error('Failed to handle the response: ', err);
                    errorEl.textContent = 'An error occurred. Please try again.';
                }
            }
            else{
                console.error('HTTP', xhr.status, xhr.responseText);
                errorEl.textContent = 'A server error occurred. Please try again later.';
            }
        };
        xhr.send(JSON.stringify(payload));
    });
});
