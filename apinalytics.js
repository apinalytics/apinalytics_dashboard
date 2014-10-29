
(function ( $ ) {

    var init = function(options) {
        // Set up default settings, overridden by options where appropriate
        var settings = $.extend(true, {
          // default settings here
          // url: 'http://127.0.0.1:7778/1/timeseries/',
          url: 'http://apinalytics.tanktop.tv/1/timeseries/',
          value: '',
          aggregation: null,
          group: null,
          granularity: null,
          application_id: null,
          key: null,
          include: null,
          title: "no title set",
        }, options);

        // Set up our objects.  If the selector we're called with has many children we potentially
        // set up many objects
        return this.each(function() {
            var $this = $(this);

            // Get access to our instance data
            var data = $this.data('apinalytics');
            if (!data) {
                // Set up our instance data

                data = {
                    $this: $this,
                    settings: settings,
                    // more instance data here
                };

                // Store our instance data
                $this.data('apinalytics', data);
            }

            var callback = data.settings.granularity === null ? json_horiz_bar_callback : json_timeseries_callback;

            // Now do initialisation
            $.ajax({
                beforeSend: function(request) {
                    request.setRequestHeader("X-Auth-User", data.settings.application_id);
                    request.setRequestHeader("X-Auth-Key", data.settings.key);
                },
                dataType: "json",
                url: data.settings.url + data.settings.start + '/' + data.settings.end + '/',
                data: {
                    value: data.settings.value,
                    group: data.settings.group,
                    granularity: data.settings.granularity,
                    aggregation: data.settings.aggregation,
                    include: data.settings.include
                },
                success: callback.bind(data)
            });
        });
    };

    var add_title = function add_title(svg, margin, width, title) {
        svg.append("g")
        .attr({
            class: "title",
            transform: "translate(" + (width / 2) + ", " + (-margin.top) + ")",
        })
        .append("text")
        .attr({
            y: 15,
            "text-anchor": "middle"
        })
        .text(title)
        ;
    };

    var add_legend = function add_legend(svg, margin, width, data, color) {
        // data is array [{key: "key name"}, ...]
        var legend = svg.append("g")
            .attr({
                class: "legend",
                // Legend is below margin
                transform: "translate(0, " + (20-margin.top) + ")"
            })
            ;

        var word_len = 80,
            radius = 5,
            key_padding = radius + 2,
            line_height = 15,
            words_per_line = Math.floor(width / word_len);

        var dx = function(d, i) {
            return (i % words_per_line) * word_len;
        };
        var dy = function(d, i) {
            return Math.floor(i / words_per_line) * line_height;
        };

        legend.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr({
                cx: dx,
                cy: function(d, i) { return dy(d,i) + line_height + 1 - radius; },
                r: radius
            })
            .style("fill", function(d, i) { return color(i); })
        ;
        legend.selectAll("text")
            .data(data)
            .enter()
            .append("text")
            .attr({
                x: function(d, i) { return dx(d, i) + key_padding; },
                y: function(d, i) { return dy(d, i) + line_height; },
            })
            .text(function(d, i) { return d.key; })
        ;
    };

    var json_timeseries_callback = function json_timeseries_callback(data, textStatus, jqXHR) {
        var that = this;
        /*
        Data is
             {
            "key": [[time, val], [time, val]]
        }
        */
        var data_vals = [];
        // Transform data.  D3 likes arrays
        for (var series_name in data.groups) {
            var series = data.groups[series_name];
            if (series_name === "") {
                series_name = "unknown";
            }
            data_vals.push({
                key: series_name,
                values: series
            });
        }

        var margin = {top: 50, right: 20, bottom: 30, left: 60},
            width = that.$this.width() - margin.left - margin.right,
            height = that.$this.height() - margin.top - margin.bottom;

        var x = d3.time.scale()
            .range([0, width]);

        var y = d3.scale.linear()
            .range([height, 0]);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .ticks(5)
            .scale(y)
            .orient("left");

        var svg = d3.select(that.$this[0]).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // From this point forward is the bit we should really do each time we reload the data
        x.domain([new Date(data.start * 1000), new Date(data.end * 1000)]);

        var color = d3.scale.category20();

        // Get the max value to set the y-axis domain
        var y_max = 0;
        var accessor = function(d) {return d[1];};
        for (var group in data_vals) {
            var group_max = d3.max(data_vals[group].values, accessor);
            y_max = Math.max(y_max, group_max);
        }
        y.domain([0, y_max]);

        // Add the x axis
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        // Add the y axis
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        // Add the title
        add_title(svg, margin, width, that.settings.title);

        // Add the legend
        add_legend(svg, margin, width, data_vals, color);

        // Somewhere for tooltips
        var tip = d3.tip().attr('class', 'd3-tip').html(function(d, i, j) {
            date = new Date(d[0] * 1000);
            return "<dl><dt>Group</dt><dd>" + data_vals[j].key + "</dd>" +
            "<dt>Value</dt><dd>" + d[1] + "</dd>" +
            "<dt>Time</dt><dd>" + d3.time.format("%e %b %Y %X")(date) + "</dd></dl>";
        });
        svg.call(tip);

        // Build something for each grouped timeseries
        var group_selection = svg.selectAll(".group")
            .data(data_vals)
          .enter().append("g")
            .attr("class", "group")
            .style("fill", function(d, i) { return color(i); });

        // How wide should our bars be?
        var gran_width = x(data.granularity) - x(0);
        console.log("gran_width", gran_width);
        var col_width = gran_width / data_vals.length;

        // Draw all the rectangles in a timeseries
        var rect = group_selection.selectAll("rect")
            .data(function(d) { return d.values; })
          .enter().append("rect")
            .attr("x", function(d, i, j) { return x(d[0] * 1000) + j * col_width; })
            .attr("y", function(d) { return y(d[1]); })
            .attr("width", col_width)
            .attr("height", 0)
            ;

        rect.on("mouseover", tip.show)
            .on("mouseout", tip.hide);

        // The rectangles transition in
        rect.transition()
            .delay(function(d, i) { return i * 10; })
            .attr("height", function(d) { return y(0) - y(d[1]); })
            ;

    };

    var json_horiz_bar_callback = function json_horiz_bar_callback(data, textStatus, jqXHR) {
        var that = this;
        var data_vals = [];
        // Transform data
        // We have a kind of dodgy timeseries thingy with a single timestamped entry.  We
        // want just the vvalues
        for (var series_name in data.groups) {
            var series = data.groups[series_name];
            if (series_name === "") {
                series_name = "unknown";
            }
            data_vals.push({
                key: series_name,
                value: series[0][1]
            });
        }

        var margin = {top: 40, right: 60, bottom: 30, left: 100},
            width = that.$this.width() - margin.left - margin.right,
            height = that.$this.height() - margin.top - margin.bottom;

        // Set up some scales.
        var color = d3.scale.category20();

        var x = d3.scale.linear()
            .domain([0, d3.max(data_vals, function(d) { return d.value; })])
            .range([0, width])
            .nice();

        var y = d3.scale.ordinal()
            .domain(data_vals.map(function(d) { return d.key; }))
            .rangeBands([height, 0], 0.33, 0.1);

        var xAxis = d3.svg.axis()
            .scale(x)
            .ticks(6)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left");

        var canvas = d3.select(that.$this[0]).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top  + ")");

        // Add the x axis
        canvas.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        // Add the y axis
        canvas.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        // Add the title
        add_title(canvas, margin, width, that.settings.title);

        // Draw the bars
        var rect = canvas.append("g").selectAll("rect")
            .data(data_vals)
          .enter().append("rect")
            .style("fill", function(d, i) { return color(i); })
            .attr("x", 0)
            .attr("y", function(d) { return y(d.key); })
            .attr("width", 0)
            .attr("height", y.rangeBand())
            ;

        // The rectangles transition in
        rect.transition()
            .delay(function(d, i) { return i * 10; })
            .attr("width", function(d) { return x(d.value); })
            ;

        // Add text for the value reached
        var text = canvas.append("g").selectAll("text")
            .data(data_vals)
            .enter()
            .append("text")
            .attr({
                x: 6,
                y: function(d) { return y(d.key) + y.rangeBand() / 2 + 6; }
            })
            .text(function(d) {return d.value; })
            ;

        // Text transitions in
        text.transition()
            .delay(function(d, i) { return i * 10; })
            .attr("x", function(d) { return x(d.value) + 6; })
            ;

    };

    // Exported methods
    var methods = {
        init: init,
          // additional methods here
    };

    $.fn.apinalytics = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.apinalytics');
        }
    };

}( jQuery ));

var QueryString = function () {
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i=0; i<vars.length; i++) {
        var pair = vars[i].split("=");

        if (typeof query_string[pair[0]] === "undefined") {
            // If first entry with this name
            query_string[pair[0]] = pair[1];

        } else if (typeof query_string[pair[0]] === "string") {
            // If second entry with this name
            var arr = [ query_string[pair[0]], pair[1] ];
            query_string[pair[0]] = arr;

        } else {
            // If third or later entry with this name
            query_string[pair[0]].push(pair[1]);
        }
    }
    return query_string;
} ();

var application_id = '';
var key = '';
if (QueryString.appId) {
    application_id = QueryString.appId;
}
if (QueryString.key) {
    key = QueryString.key;
    if (key.length % 4 !== 0) {
        // = padding at the end has probably been stripped out
        var need = 4 - (key.length % 4);
        for (;need > 0; need--) {
            key += "=";
        }
    }
}


$(document).ready(function() {
    var now = Math.floor(new Date().getTime() / 1000);
    $("#chart1").apinalytics({
        title: "Call count per consumer in last week",
        application_id: application_id,
        key: key,
        group: 'consumer_id',
        granularity: 'hour',
        start: now - 7 * 24 * 60 * 60,
        end: now,
    });

    $("#chart2").apinalytics({
        title: "Call count per function in last 24 hours",
        application_id: application_id,
        key: key,
        group: 'function',
        granularity: 'hour',
        start: now - 24 * 60 * 60,
        end: now,
    });

    $("#chart3").apinalytics({
        title: "Mean response time per function in last day",
        application_id: application_id,
        key: key,
        group: 'function',
        value: 'response_us',
        aggregation: 'mean',
        granularity: 'hour',
        start: now - 24 * 60 * 60,
        end: now,
    });

    $("#chart3-1").apinalytics({
        title: "Mean response time per function in last hour",
        application_id: application_id,
        key: key,
        group: 'function',
        value: 'response_us',
        aggregation: 'mean',
        granularity: 'minute',
        start: now - 60 * 60,
        end: now,
    });

    // Count of different functions in current day
    $("#chart4").apinalytics({
        title: "Function breakdown for current day",
        application_id: application_id,
        key: key,
        group: 'function',
        start: now - 24 * 60 * 60,
        end: now
    });

    // Total count of api calls in a month for each consumer
    $("#chart5").apinalytics({
        title: "API calls per consumer this month",
        application_id: application_id,
        key: key,
        group: 'consumer_id',
        start: now - 30 * 24 * 60 * 60,
        end: now
    });

    // API calls today grouped by status code
    $("#chart6").apinalytics({
        title: "Status codes today",
        application_id: application_id,
        key: key,
        group: 'status_code',
        start: now - 24 * 60 * 60,
        end: now
    });

    $("#chart7").apinalytics({
        title: "Total response time per minute in the last hour",
        application_id: application_id,
        key: key,
        value: 'response_us',
        aggregation: 'sum',
        granularity: 'minute',
        start: now - 60 * 60,
        end: now,
    });

});