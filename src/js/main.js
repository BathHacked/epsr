var resetMap;

var handleData = function(){

  d3.csv('data/epsr.csv', function(error, data){

    dc.dateFormat = d3.time.format('%d/%m/%Y');

    var inputFormat = d3.time.format('%d/%m/%Y %H:%M:%S %p');

    data.forEach(function(d){
      var n = {};
      d.received = inputFormat.parse(d.receiveddate);
      d.receivedWeek = d.received ? d3.time.week(d.received) : null;
      d.closed = inputFormat.parse(d.closeddate);
      d.closedWeek = d.closed ? d3.time.week(d.closed) : null;
      d.weeks = d.closed && d.received ? 1 + Math.floor(Math.abs(moment(d.closed).diff(moment(d.received), 'weeks'))) : null;
      d.hourofday = d.received ? moment(d.received).format('HH') : null;
      d.dayofweek = d.received ? moment(d.received).format('ddd') : null;
      d.dayofmonth = d.received ? moment(d.received).format('DD') : null;
      d.month = d.received ? moment(d.received).format('MMM') : null;
      d.type = d.type || 'N/A';
      d.receivedhow = d.receivedhow || 'N/A';
      d.receivedwhere = d.receivedwhere || 'N/A';
      d.latlng = [d.latitude, d.longitude];
      var phase = SunCalc.getMoonIllumination(d.received).phase;
      d.moon = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][Math.floor(phase * 4)];
      delete(d.location);
      delete(d.ref);
      delete(d.receiveddate);
      delete(d.closeddate);
    });

    var xf = crossfilter(data);
    var dim = {};
    var grp = {};
    var chart = {};

    chart['all'] = dc.dataCount('#chart-all')
      .dimension(xf)
      .group(xf.groupAll())
      .html({
        some: '<strong>%filter-count</strong> selected out of <strong>%total-count</strong> requests' +
        ' <a href="javascript:dc.filterAll(); dc.renderAll(); resetMap();"><i class="fa fa-fw fa-minus-circle"></i> View all requests</a>',
        all: 'All records selected. Please use the graphs to apply filters.'
      })
    ;

    ['kind', 'type', 'status', 'receivedhow', 'receivedwhere', 'hourofday', 'dayofweek', 'dayofmonth', 'month', 'moon'].forEach(function(k){
      dim[k] = xf.dimension(dc.pluck(k));
      grp[k] = dim[k].group().reduceCount();

      chart[k] = dc.rowChart('#chart-' + k);
      chart[k]
        .width($('#chart-' + k).parent().width())
        .height(320)
        .margins({top: 0, right: 10, bottom: 30, left: 10})
        .dimension(dim[k])
        .group(grp[k])
        .ordering(function(d){return -d.value;})
        .elasticX(true)
        .label(function(d){return d.key + ': ' + d.value;})
        .gap(3)
        .colors(d3.scale.ordinal().range(['#B6BBC6']))
        .xAxis().ticks(2)
      ;
    });

    ['received', 'closed'].forEach(function(k){
      dim[k] = xf.dimension(dc.pluck(k + 'Week'));
      grp[k] = dim[k].group().reduceCount();

      chart[k] = dc.lineChart('#chart-' + k);
      chart[k]
        .width($('#chart-' + k).parent().width())
        .height(150)
        .margins({top: 10, right: 20, bottom: 25, left: 30})
        .dimension(dim[k])
        .group(grp[k])
        .renderArea(true)
        .mouseZoomable(false)
        .x(d3.time.scale().domain([new Date(2014,0,0), new Date()]))
        .elasticX(true)
        .xUnits(d3.time.days)
        .round(d3.time.day.round)
        .elasticY(true)
        .renderHorizontalGridLines(true)
        .colors(d3.scale.ordinal().range(['#2C3E50']))
        .xAxis().ticks(4)
      ;
    });


    ['weeks'].forEach(function(k){
      dim[k] = xf.dimension(dc.pluck(k));
      grp[k] = dim[k].group().reduceCount();

      chart[k] = dc.barChart('#chart-' + k);
      chart[k]
        .width($('#chart-' + k).parent().width())
        .height(150)
        .margins({top: 10, right: 20, bottom: 25, left: 30})
        .dimension(dim[k])
        .group(grp[k])
        .x(d3.scale.linear().domain([1,dim[k].top(1)[0][k] + 1])) // dim[k].top(1)[0][k] + 1
        .round(dc.round.ceil)
        .elasticY(true)
        .renderHorizontalGridLines(true)
        .colors(d3.scale.ordinal().range(['#2C3E50']))
        .xAxis().ticks(4)
      ;
    });

    chart['table'] = dc.dataTable('#chart-table')
      .dimension(dim['received'])
      .group(function(d){
        var format = d3.format('02d');
        return d.received.getFullYear() + '/' + format((d.received.getMonth() + 1));
      })
      .size(100)
      .columns([
        {label: 'Received', format: function(d){var m = moment(d.received); return m.isValid() ? m.format('DD/MM/YYYY') : '';}},
        {label: 'Closed', format: function(d){var m = moment(d.closed); return m.isValid() ? m.format('DD/MM/YYYY') : '';}},
        'days',
        'kind',
        'type',
        'status',
        {label: 'How', format: dc.pluck('receivedhow')},
        {label: 'Where', format: dc.pluck('receivedwhere')}
      ])
      .sortBy(dc.pluck('received'))
      .order(d3.descending)
    ;

    var RequestIcon = L.Icon.extend({
      options: {
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
        shadowUrl: 'img/icon-shadow.png'
      }
    });

    var defaultIcon = new RequestIcon({iconUrl: 'img/icon-default.png'});
    var selectedIcon = new RequestIcon({iconUrl: 'img/icon-selected.png'});

    dim.location = xf.dimension(function(d){return d.latlng;});
    grp.location = dim.location.group().reduceCount();

    var locationMarkers = [];

    chart.location = dc_leaflet.markerChart('#chart-location');
    chart.location
      .width($('#chart-location').parent().width())
      .height(480)
      .dimension(dim.location)
      .group(grp.location)
      .mapOptions({
        maxBounds: [[51.2719,-2.70944],[51.4397,-2.27768]],
        minZoom: 11
      })
      .center([51.3844,-2.3642])
      .zoom(13)
      .marker(function(d){
        var m = L.marker(d.key, {selected: false, icon: defaultIcon});

        m.on('click', function(e){
          if(e.target.options.selected) {
            e.target.options.selected = false;
            e.target.setIcon(defaultIcon);
          } else {
            e.target.options.selected = true;
            e.target.setIcon(selectedIcon);
          }
        });

        locationMarkers.push(m);

        return m;
      })
      .renderPopup(false)
      .popup(function(d){return 'Count: ' + d.value;})
      .cluster(true)
      .clusterOptions({
        disableClusteringAtZoom: 16
      })
      .brushOn(true)
      .filterByArea(false)
    ;

    resetMap = function() {
      _.each(locationMarkers, function(m){
        m.options.selected = false;
        m.setIcon(defaultIcon);
      });
    };

    _.each(_.keys(chart), function(k){
      $('a[href="#' + k + '"]').on('click', function(e){
        e.preventDefault();
        chart[k].filterAll();
        dc.redrawAll();
      });
    });

    dc.renderAll();

    var locationMap = chart.location.map();

    locationMap.on('click', function(e){
      _.forEach(locationMarkers, function(m){
        m.options.selected = false;
        m.setIcon(defaultIcon);
      });
    });


    $(window).on('resize', function(){

      setTimeout(function(){

        _.each(_.keys(chart), function(k){
          chart[k]
            .width($('#chart-' + k).parent().width());
        });

        dc.redrawAll();

        locationMap.invalidateSize();

      },100);
    });

  });

};


$(function(){

  handleData();

});
