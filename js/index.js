var API_URL = './api.php';
var apiKey = localStorage.getItem('apikey') || '3a160d66562032f9'; //stored api key or default
var productContainer = document.querySelector('.proCont');  //container where products go
var navBar = document.getElementById('header');

//-----------If user is logged in...-----------------
if (apiKey && apiKey !== '3a160d66562032f9'){
    //remove login button
    var loginLink = navBar.querySelector('a[href="login.html"]');
    if (loginLink){
        var li = loginLink.parentNode;
        li.parentNode.removeChild(li);
    }

    //remove signup button
    var signupLink = navBar.querySelector('a[href="signup.html"]');
    if (signupLink){
        var li2 = signupLink.parentNode;
        li2.removeChild(li2);
    }
    //add greeting
    var storedname = localStorage.getItem('name');
    if (storedname){
        var greetingLi = document.createElement('li');
        var greetSpan = document.createElement('span');
        greetSpan.textContent = 'Hello, ' + storedname + '!';
        greetSpan.style.marginRight = '1em';
        greetingLi.appendChild(greetSpan);

        var navBar = document.getElementById('header');
        navBar.insertBefore(greetingLi, navBar.firstChild);
    }

    //adds logout button
    var logoutLi = document.createElement('li');
    var logoutA = document.createElement('a');
    logoutA.href = '#';
    logoutA.textContent = 'Logout';
    logoutLi.appendChild(logoutA);
    navBar.appendChild(logoutLi);

    //clear apikey and redirect to index
    logoutA.addEventListener('click', function(e){
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

function fetchAndRenderProducts(options){
    options = options || {};

    // var apiKey = localStorage.getItem('apikey');
    // if (!apiKey){
    //     window.location.href = 'login.html';
    //     return;
    // }

    var payload = {
        type: 'GetAllProducts',
        apikey: apiKey,
        return: ['ProductID', 'Title', 'Brand', 'Image_url'],
        search: {},
        fuzzy: (typeof options.fuzzy ===  'boolean' ? options.fuzzy : true)
    };
    //search
    if (options.search && options.search.text){
        payload.search.Title = options.search.text;
    }
    //category
    if (options.category){
        payload.search.Category = options.category;
    }
    //price range
    if (typeof options.priceMin === 'number'){
        payload.search.price_min = options.priceMin;
    }
    if (typeof options.priceMax === 'number'){
        payload.search.price_max = options.priceMax;
    }
    //sorting
    if (options.sort){//sort on...
        payload.sort = options.sort;
    }
    if (options.order){ //ascending/descending
        payload.order = options.order;
    }

    //POST
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;

        var raw = xhr.responseText.trim();
        var resp;

        // Try parsing JSON
        try {
            resp = JSON.parse(raw);
        } catch (e) {
            // Failed—so log the full HTML payload for diagnosis
            console.error('❌ Non-JSON response from API:', raw);
            productContainer.innerHTML =
            '<p class="error">Server error loading products; check console.</p>';
            return;
        }

        // Now you know resp is a JS object
        if (resp.status === 'success') {
            renderProducts(resp.data);
        } else {
            console.error('API error:', resp.data);
            productContainer.innerHTML =
            '<p class="error">Error: ' + resp.data + '</p>';
        }
    };

    xhr.send(JSON.stringify(payload));

    //Clear product container and append new cards
    function renderProducts(products){
        productContainer.innerHTML = '';
        for (var i = 0; i < products.length; i++){
            var p = products[i];
            var card = document.createElement('div');
            card.className = 'pro';

            card.innerHTML = '<img src="' + p.Image_url + '" alt = "' + p.Title + '">' +
            '<div class = "description">' + '<h5>' + p.Title + '</h5>' + '<h4>From R' + (p.LowestPrice ? p.LowestPrice.toLocaleString() : '-')
            + '</h4>' + '</div>' + '<a href="compare.html"><i class= "fa-solid fa-arrow-right-arrow-left compare"></i></a>' +
            '<a href= "favourites.html"><i class = "fa-regular fa-heart favourites"></i></a>';
            //event listener to go to view page
            (function(pid, el){
                el.addEventListener('click', function(){
                    window.location.href = 'view.html?productID=' + pid;
                });
            })(p.ProductID, card);

            productContainer.appendChild(card);

        }
    }

}
//---------------------------FILTERS (actually showing/using them)---------------------------
document.addEventListener("DOMContentLoaded", function() {
    fetchAndRenderProducts();
    //search button
    document.getElementById('searchBut').addEventListener('click', function (){
        var text = document.getElementById('searchInput').value.trim();
        fetchAndRenderProducts({
            search: {
                text: text
            }
        });
    });
    //category dropdown
    document.getElementById('category').addEventListener('change', function(e){
        fetchAndRenderProducts({
            category: e.target.value
        });
    });
    //price range
    document.getElementById('price').addEventListener('change', function(e){
        var val = e.target.value;
        if (val === 'low'){
            fetchAndRenderProducts({
                sort: 'price',
                order: 'ASC'
            });
        }
        else if (val === 'high'){
            fetchAndRenderProducts({
                sort: 'price',
                order: 'DESC'
            });
        }
        else{
            fetchAndRenderProducts();
        }
    });
});