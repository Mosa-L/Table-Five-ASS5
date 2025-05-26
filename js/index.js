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
        li2.parentNode.removeChild(li2);
    }
    //add greeting
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

        var navBar = document.getElementById('navbar');
        navBar.insertBefore(greetingLi, navBar.firstChild);
    }

    //adds logout button
    var logoutLi = document.createElement('li');
    logoutLi.style.listStyleType = 'none';
    logoutLi.style.display       = 'inline-block';
    logoutLi.style.marginRight   = '1em';
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

function fetchCategories() {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, true);
  xhr.setRequestHeader('Content-Type','application/json');
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    try {
      var res = JSON.parse(xhr.responseText);
      if (res.status === 'success') {
        populateCategoryDropdown(res.data);
      } else {
        console.error('Could not load categories:', res.data);
      }
    } catch(e) {
      console.error('Category parse error:', xhr.responseText);
    }
  };
  xhr.send(JSON.stringify({
    type:    'GetDistinct',
    apikey:  apiKey,
    field:   'Category'
  }));
}

function populateCategoryDropdown(categories) {
  var select = document.getElementById('category');
  // clear any existing options
  select.innerHTML = '<option value="">All Categories</option>';
  for (var id in categories) {
    if (categories.hasOwnProperty(id)) {
      var opt = document.createElement('option');
      opt.value = categories[id].toLowerCase();
      opt.textContent = categories[id];
      select.appendChild(opt);
    }
  }
}

function fetchAndRenderProducts(options){
    options = options || {};

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

        var raw = xhr.responseText.trim(), resp;
        try {
            resp = JSON.parse(raw);
        } catch (e) {
            console.error('Non-JSON response:', raw);
            productContainer.innerHTML = '<p class="error">Server error loading products.</p>';
            return;
        }

        if (resp.status !== 'success') {
            console.error('API error:', resp.data);
            productContainer.innerHTML = '<p class="error">Error: ' + resp.data + '</p>';
            return;
        }

        //Grab all products
        var products = resp.data;

        //If category filtering was requested, apply it client-side
        if (options.category) {
            products = products.filter(function(p) {
            return Array.isArray(p.Categories) &&
                    p.Categories.some(function(catName) {
                    return catName.toLowerCase() === options.category;
                    });
            });
        }
        renderProducts(products);
        };


    xhr.send(JSON.stringify(payload));

    //Clear product container and append new cards
    function renderProducts(products){
        productContainer.innerHTML = '';
        for (var i = 0; i < products.length; i++){
            var p = products[i];
            var card = document.createElement('div');
            card.className = 'pro';

            card.innerHTML = 
            '<img src="' + p.Image_url + '" alt="' + p.Title + '">' +
            '<div class="description">' +
                '<h5>' + p.Title + '</h5>' +
                '<h4>From R' + (p.LowestPrice || '-') + '</h4>' +
            '</div>' +
            //compare button
            '<a href="#" class="compare-btn" title="Add to compare">' +
                '<i class="fa-solid fa-arrow-right-arrow-left compare"></i>' +
            '</a>' +
            //favourites button
            '<a href="#" class="fav-btn" title="Add to favourites">' +
                '<i class="fa-regular fa-heart favourites"></i>' +
            '</a>';

            productContainer.appendChild(card);

            (function(product){
				card.querySelector('.compare-btn').addEventListener('click', function(e){
					e.stopPropagation();
					localStorage.setItem('compareList', JSON.stringify([product]));
					window.location.href = 'compare.html';
				});
			})(p);

            //go to view page
            (function(pid, el){
                el.addEventListener('click', function(){
                    window.location.href = 'view.html?productID=' + pid;
                });
            })(p.ProductID, card);


            (function(pid, favBtn) {
                favBtn.addEventListener('click', function(e) {

                    e.preventDefault();
                    e.stopPropagation();

                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', API_URL, true);
                    xhr.setRequestHeader('Content-Type','application/json');
                    xhr.onreadystatechange = function() {
                    if (xhr.readyState !== 4) return;
                    try {
                        var r = JSON.parse(xhr.responseText);
                        if (r.status === 'success' || r.data.indexOf('already') !== -1) {
                        //heart fills in if it is in favorites
                        var icon = favBtn.querySelector('i');
                        icon.classList.remove('fa-regular');
                        icon.classList.add('fa-solid');
                        } else {
                        console.error('Fav API error:', r.data);
                        }
                    } 
                    catch (err){
                        console.error('Fav parse error:', xhr.responseText);
                    }
                    };
                    
                    xhr.send(JSON.stringify({
                    type:      'Favourite',
                    apikey:    apiKey,
                    ProductID: pid
                    }));
                });
            })(p.ProductID, card.querySelector('.fav-btn'));
        }
    }

}
//---------------------------FILTERS (actually showing/using them)---------------------------
document.addEventListener("DOMContentLoaded", function() {
    fetchCategories();
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