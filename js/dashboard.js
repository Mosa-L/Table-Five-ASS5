var API_URL = './api.php';
var apiKey = localStorage.getItem('apikey');

function fetchAllProducts(cb){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function(){
        if (xhr.status >= 200 && xhr.status < 300){
            try{
                var r = JSON.parse(xhr.responseText);
                if (r.status === 'success'){
                    cb(r.data);
                }
                else{
                    console.error('API error:', r.data);
                }
            }
            catch (err){
                console.error('Invalid JSON: ',xhr.responseText);
            }
        }
        else{
            console.error('HTTP error:', xhr.status);
        }
    };
    xhr.send(JSON.stringify({
        type: 'GetAllProducts',
        apikey: apiKey,
        return: ['ProductID', 'Title', 'Brand', 'Image_url']
    }));
}

document.addEventListener('DOMContentLoaded', function(){
    fetchAllProducts(function(products){
        renderTopRated(products);
        renderReviewHistogram(products);
    });
});

function renderTopRated(products){
    //count and average every product
    products.forEach(function(p){
        var sum = 0;
        p.Reviews.forEach(function(r){
            sum += r.Rating;
        });
        p._count = p.Reviews.length;
        p._avg = p._count ? (sum / p._count) : 0;
    });

    var ratedOnly = products.filter(function(p){
        return p._count > 0;
    });

    //sort descending by average rating
    ratedOnly.sort(function(a, b){
        return b._avg - a._avg;
    });
    var top4 = ratedOnly.slice(0, 4);

    var grid = document.getElementById('top-products-grid');
    grid.innerHTML = ''; //clears existing content

    top4.forEach(function(p){
        var avg = p._avg.toFixed(1);
        var count = p._count;

        var card = document.createElement('div');
        card.className = 'compare-product';
        card.innerHTML =
            '<img src="' + p.Image_url + '" alt="' + p.Title + '">' +
            '<div class="compare-desc">' +
                '<h5>' + p.Title + '</h5>' +
                '<h4>Avg. Rating: <span style="color:gold;">' + avg + ' ★</span></h4>' +
                '<p style="font-size:13px; color:#888;">' +
                (p.Categories||[]).join(', ') + '</p>' +
                //makes the reviews to be able to expand
                '<p style="font-size:13px; color:#007bff; cursor:pointer;" class="review-toggle">' +
                count + ' review(s)</p>' +
            '</div>';

        grid.appendChild(card);

        var toggleEl = card.querySelector('.review-toggle');
        toggleEl.addEventListener('click', function(e){
            var existing = card.querySelector('.reviews-list');
            if (existing){
                existing.parentNode.removeChild(existing);
                return;
            }
            var list = document.createElement('div');
            list.className = 'reviews-list';
            list.style.padding = '0.5em';
            list.style.borderTop = '1px solid #ddd';
            list.style.background = '#fafafa';

            p.Reviews.forEach(function(r){
                var item = document.createElement('div');
                item.style.marginBottom = '0.5em';
				let dateStr = '';
				if(r.Date){
					const safeDate = r.Date.replace(' ', 'T');
					const d = new Date(safeDate);
					dateStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString();
				}
                item.innerHTML =
                    '<strong>' + r.Name + ' ' + r.Surname + '</strong> &mdash; ' +
                    '<span style="color:gold;">' + r.Rating + ' ★</span><br>' +
                    '<em style="font-size:0.9em;">' + r.Date + '</em><br>' +
                    '<p style="margin:0.2em 0;">' + r.Comment + '</p>';
                list.appendChild(item);
            });
            card.appendChild(list);
        });
    });
}

function renderReviewHistogram(products){
    //tallies up every rating
    var histogram = {1:0, 2:0, 3:0, 4:0, 5:0};
    var maxCount = 0;
    products.forEach(function(p){
        p.Reviews.forEach(function(r){
            histogram[r.Rating] = (histogram[r.Rating] || 0) + 1;
        });
    });
    Object.values(histogram).forEach(function(c){
        if (c > maxCount){
            maxCount = c;
        }
    });

	//assigns ratings to bars
    [1,2,3,4,5].forEach(function(star){
        var barEl = document.querySelector('.dashboard-review-bar-' + star);
        var count = histogram[star] || 0;
        var height = maxCount ? (count/maxCount) * 200 : 0;
        if (barEl){
            barEl.style.height = height + 'px';
        }
        var lbl = barEl ? barEl.parentNode.querySelector('.dashboard-review-bar-count') : null;
        if (lbl){
            lbl.textContent = count;
        }
    });
}

