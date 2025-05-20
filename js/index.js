var API_URL = './api.php';
var apiKey = localStorage.getItem('apikey') || 'sente/lesedi apikey'; //stored api key or default
var productContainer = document.querySelector('.proCont');  //container where products go

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
    xhr.onreadystatechange = function(){
        if (xhr.readyState !== 4){
            return;
        }
        if (xhr.status >= 200 && xhr.status < 300){
            try{
                var resp = JSON.parse(xhr.responseText);
                if (resp.status === 'success'){
                    renderProducts(resp.data);
                }
                else{
                    throw new Error(typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data));
                }
            }
            catch (e){
                console.error('Failed to handlle the response: ', e);
                productContainer.innerHTML = '< p class = "error">Sorry, could not load products.</p>';
            }
        }
        else{
            console.error('API returned HTTP ' + xhr.status);
            productContainer.innerHTML = '<p class = "error">Sorry, could not load products.</p>';
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
            + '</h4>' + '</div>' + '<a href="compare.html"> i class= "fa-solid fa-arrow-right-arrow-left compare"></i></a>' +
            '<a href= "favourites.html"><i class = "fa-regular fa-heart favourites"></i></a>';
            productContainer.appendChild(card);
            
        }
    }

}
//---------------------------FILTERS (actually showing/using them)---------------------------
document.addEventListener("DOMContentLoaded", function() {
    fetchAndRenderProducts();
    //search button
    document.getElementById('searchBtn').addEventListener('click', function (){
        var text = document.getElementById('searchInput').ariaValueMax.trim();
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