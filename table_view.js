/**
  * function used to render the acc table on the javascript side
 **/
var acc_table_view = Class.create();
acc_table_view.prototype = {
    /**
    * constructor function of the acc_table view
    * initializes some start values
    */
    initialize: function(options) {
        //checking if image path and styles are already defined
        if (!options.image_path) {
            options.image_path = "wfe/acc/img/icons/";
        }

        if (!options.table_styles) {
            options.table_styles = {
                "caption_table" : "resources_caption_style",
                "caption_tr"    : "resources_caption_tr_style",
                "td_style1"     : "resources_td_style1",
                "td_style2"     : "resources_td_style2"
            }
        }

        this.filter = true;

        this.tooltip_caller = "";

        this.ie_opacity = 40;
        this.ff_opacity = 0.5;

        //initialize data storage variable
        this.data_storage = new Array();

        //save the options submitted in a class attribute
        this.options = options;

        //create hidden ids variable, which is empty at the start;
        this.hidden_guids = new Array();

        //set the last_devices variable to the new value
        last_devices = Object.toJSON( this.options.arr_ids );

        //if width, height and bgcolors aren't set, take the default values
        if ( !this.options.width ) {
            this.options.width = 744;
        }

        if ( !this.options.height) {
            this.options.height = 558;
        }

        if ( !this.options.bgcolors ) {
            this.options.bgcolors = ['#eeeeee','#dddddd'];
        }

        // create an Object that contains the information which column was sorted last
        this.last_column_sorted = new Object();
        if (typeof this.options.sort_column != "undefined") {
            this.last_column_sorted.column_name = this.options.sort_column;
        }
        else {
            this.last_column_sorted.column_name = "devicename";
        }

        this.last_column_sorted.direction   = "up";

        //used on reporting pages to decide if the sorting of the columns was changed
        this.column_changed   = false;
        this.sorting_started  = false;

        // create Object with index of the first and last element displayed
        this.tr_displayed = new Object();

        if (this.options.arr_ids.length == 0 ) {
            this.tr_displayed.low = 0;
        }
        else {
            this.tr_displayed.low = 1;
        }

        //check which number should be taken as the highest index
        if (this.options.arr_ids.length < this.options.max_tr_elements) {
            this.tr_displayed.high = this.options.arr_ids.length;
        }
        else {
            this.tr_displayed.high = this.options.max_tr_elements;
        }

        // create update variable to sort only when something has changed
        // has to be changed when a notification changes some data
        this.updated = false;

        // helping values for hiding tooltips when device is removed or sorted
        this.tooltipId = -1;
        this.tooltipRow = -1;

        //for vpn configuration page only, check if vpn policies were submitted
        if (this.options.policies != undefined) {
            //set the data in the policy mapper object
            if (vpn_policy_mapper != undefined) {
                vpn_policy_mapper.setPolicies(this.options.policies);
            }
        }

        this.tmp_objects = new Array();

        //create the objects for the data storage and the tmp_objects
        for (var j = 0; j < this.options.captions.length; j++) {
            //create empty hash to contain all relevant data
            this.data_storage[j] = {};
            var tmp_object = this.getWidget(this.options.captions[j].widget, j);
            this.tmp_objects.push(tmp_object);
        }

        //save all the relevant data in the data storage
        for (var i = 0; i < this.options.arr_ids.length; i++) {
            this.save_data_in_data_storage(this.options.captions, this.options.table_data, this.options.dev_info, this.options.arr_ids[i], i);
        }
        return this;
    },

    getWidget: function(widget_name, j) {
        //allow number widget to be referenced by an acronym
        if (widget_name == 'number') {
            widget_name = 'acc_widget_number';
        }

        try {
            var create_func = eval(widget_name);
            if (typeof create_func == 'function') {
                tmp_object = new create_func("");
            }
        }
        catch(e) {
            _debug("Couldn't create widget: " + widget_name + " -> " + e);
            tmp_object = new acc_widget_string("");
        }
        return tmp_object;
    },

    drawTable: function(table_data) {
        //reduce width of table if we are on aggregated reporting page
        var header_extension = '';
        if (typeof table_data.noheader != "undefined" && table_data.noheader != 0 ) {
            header_extension = "_noheader";
        }

        table_element = document.createElement("table");
        if (browser == "ie") {
            table_element.className ="resources_main_table_ie" + header_extension;
        }
        else {
            if (navigator.userAgent.match(/Firefox\/2/)) {
                table_element.className ="resources_main_table_style_ff2" + header_extension;
            }
            else {
                table_element.className ="resources_main_table_style" + header_extension;
            }
        }

        with ( table_element ) {
            setAttribute("cellspacing","0");
            setAttribute("id","acc_table_" + table_data.name + "_items");
        }

        tbody_element = document.createElement("tbody");
        tr_element = document.createElement("tr");

        tr_element.className = table_data.table_styles.caption_tr;
        tr_element.setAttribute("id", "tr_caption");

        tbody_element.appendChild(tr_element);
        table_element.appendChild(tbody_element);

        // building up the caption table line
        for (var i = 0; i < table_data.captions.length; i++) {

            var td_element = document.createElement("td");

            //checking if checkbox or normal text is needed
            if (table_data.captions[i].widget == "acc_widget_checkbox") {

                var tmp_object = new acc_widget_checkbox("caption_" + i);
                var checkbox_main_element = tmp_object.drawWidget("caption_" + i, "main");
                checkbox_main_element.className = "resources_checkbox_style_main";

                //add function call to the created Checkbox element
                checkbox_main_element.onclick = this.main_checkbox_changed;
                td_element.style.width = "25px";
                td_element.appendChild(checkbox_main_element);
            }
            else if (table_data.captions[i].widget == "acc_widget_realcheckbox" || table_data.captions[i].widget == 'acc_widget_access_rights' ) {
                var column_name = table_data.captions[i].identifier;
                var icon_name = table_data.captions[i].icon;
                td_element.setAttribute("clickname", column_name);
                td_element.setAttribute("index", i);
                td_element.setAttribute("align", "center");

                var tmp_object = new acc_widget_caption_realcheckbox(i);
                td_element.appendChild(tmp_object.drawWidget(table_data.captions[i].name, table_data.image_path, column_name, icon_name));
            }
            else {

                //create an Array for each column in the data storage
                var column_name = table_data.captions[i].identifier;

                td_element.setAttribute("clickname", column_name);
                td_element.setAttribute("index", i);
                td_element.setAttribute("align", "center");

                var tmp_object = new acc_widget_caption_arrow("");
                td_element.appendChild(tmp_object.drawWidget(table_data.captions[i].name, table_data.image_path, column_name, this));

                //call the sort function
                if (table_data.captions[i].widget != "acc_widget_empty") {
                   td_element.onclick = function(){ acc_table.sort_column(this.getAttribute("clickname"), true)};
                }

                td_element.onmouseover = function() { acc_table.show_tooltip(this.id, "caption")};

                td_element.onmouseout  = function() { acc_table.hide_tooltip()};

                if (typeof(table_data.captions[i].width) != 'undefined') {
                    td_element.style.width = table_data.captions[i].width;
                }
                else {
                    if (table_data.captions[i].identifier == "level") {
                        td_element.style.width = "7%";
                    }
                    else if (table_data.captions[i].identifier == "devicename") {
                        td_element.style.width = "15%";
                    }
                }
            }

            td_element.setAttribute("id", "captions_" + table_data.captions[i].identifier.toLowerCase());
            td_element.className = table_data.table_styles.caption_table;
            tr_element.appendChild(td_element);
        }

        tbody_element.appendChild(tr_element);
        //end of building the captions line

        //check if filter should be created
        if (this.filter) {
            var tr_filter = this.draw_filter(table_data);
            tbody_element.appendChild(tr_filter);
        }

        //building up the rest of the table
        if (! Object.isArray(table_data.arr_ids) || table_data.arr_ids.length == 0) {
            tr_element = document.createElement("tr");
            var td_element = document.createElement("td");
            td_element.setAttribute("colSpan", table_data.captions.length);

            var no_data_message = "Either there are no devices connected, your current access level is insufficient or at least one filter is active.";

            if (typeof table_data['no_data_message'] != "undefined" && table_data['no_data_message']) {
                no_data_message = table_data['no_data_message'];
            }
            else if (typeof acc_table.options.name && acc_table.options.name == "vpn") {
                no_data_message = "Either there are no VPNs defined, your current access level is insufficient or at least one filter is active.";
            }
            else if (typeof acc_table.options.name && acc_table.options.name == "Access Group Control") {
                no_data_message = "Either no devices are connected, your access level is insufficient, at least one filter is active or the Root Org. Unit is selected.";
            }

            td_element.appendChild(document.createTextNode(no_data_message));
            td_element.className = table_data.table_styles.td_style1;
            td_element.style.textAlign = "center";
            tr_element.appendChild(td_element);
            tbody_element.appendChild(tr_element);
        }
        else {
            var loops;

            if (table_data.arr_ids.length < table_data.max_tr_elements) {
                loops = table_data.arr_ids.length;
            }
            else {
                loops = table_data.max_tr_elements;
            }

            for (var j = 0; j < loops; j++) {
                if ( j % 2 == 0) {
                    var td_style = table_data.table_styles.td_style1;
                }
                else {
                    var td_style = table_data.table_styles.td_style2;
                }
                var tr_element = this.create_normal_tr_element(
                    table_data.captions,
                    table_data.image_path,
                    td_style,
                    table_data.arr_ids[j]
                );
                tbody_element.appendChild(tr_element);
            }
        }

        //appending the rest of the table
        table_element.appendChild(tbody_element);
        return table_element;
    },

    /** function used to create a filter tr for the table
    *
    **/
    draw_filter: function(table_data) {
        var tr_filter = document.createElement("tr");
        tr_filter.setAttribute("id", "tr_filter");

        for (var i = 0; i < table_data.captions.length; i++) {
            var td_filter = document.createElement("td");
            td_filter.className = "resources_filter_style";

            //set ids of the filter
            td_filter.id = "resources_filter_" + table_data.captions[i]["identifier"];

            //get the filter width
            var filter_width = this.get_filter_width(table_data, i);

            var filter_value = this.get_filter_value(table_data, i);

            var filter_info = this.tmp_objects[i].getFilterData();

            if ( filter_info["showFilter"] ) {

                if ( filter_info["type"] == "input") {
                    var input_filter = document.createElement("input");
                    input_filter.type = "text";
                    input_filter.size = 30;
                    input_filter.maxlength = 255;
                    input_filter.className = "resources_filter_input";
                    input_filter.id = "acc_filter_" + table_data.captions[i]["identifier"];

                    if (filter_width) {
                        input_filter.style.width = filter_width;
                    }

                    Event.observe( input_filter, 'keyup', filter_action.bindAsEventListener(this, input_filter, i), false);

                    td_filter.appendChild(input_filter);

                    if (inner_key_exists(table_data, ['restoreFilters']) &&
                        table_data.restoreFilters &&
                        filter_value
                    ) {
                        input_filter.value = filter_value;
                    }
                }
                else if ( filter_info["type"] == "dropdown" ) {
                    var dropdown_filter = document.createElement("select");

                    //country dropdown on access control page should have different style
                    if (filter_info["filterMethod"] != "country") {
                        dropdown_filter.className = "resources_filter_select";
                    }
                    else {
                        dropdown_filter.className = "resources_filter_select_country";
                    }

                    dropdown_filter.id = "acc_filter_" + table_data.captions[i]["identifier"];

                    if (filter_width != "") {
                        dropdown_filter.style.width = filter_width;
                    }

                    Event.observe( dropdown_filter, 'change', filter_action.bindAsEventListener(this, dropdown_filter, i), false);

                    var filterParams = new Array();
                    filterParams = filter_info["params"];

                    for (var j = 0; j < filterParams.length; j++ ) {
                        var option_filter = document.createElement("option");

                        if ( filter_info["values"] != undefined && typeof filter_info["values"][j] != "undefined") {
                            option_filter.setAttribute("value", filter_info["values"][j]);
                        }

                        if ( typeof filter_info["filterStyles"] != "undefined" && filter_info["filterStyles"][j] != "") {
                            option_filter.className = filter_info["filterStyles"][j];
                        }

                        if (filter_info["filterMethod"] == "country") {
                            option_filter.className = "resources_filter_option_country";
                            if ( j != 0) {
                                var country_code = country_mapping_hash_reverse[filterParams[j]];
                                option_filter.style.backgroundImage = 'url(core/img/flags/flag_' +country_code+'.png)';
                            }
                        }

                        if (inner_key_exists(table_data, ['restoreFilters']) &&
                            table_data.restoreFilters && filter_value &&
                            inner_key_exists(filter_info, ['values', j]) &&
                            filter_info["values"][j] == filter_value
                        ) {
                            option_filter.selected = 'selected';
                        }

                        var text_option   = document.createTextNode(filterParams[j]);
                        option_filter.appendChild(text_option);

                        dropdown_filter.appendChild(option_filter);
                    }
                    td_filter.appendChild(dropdown_filter);
                }
                else if ( filter_info["type"] == "optgroup" ) {
                    //get the information about which and how many meta data is available
                    //filter_info.filterObject.getColumnInfo(i);

                    var dropdown_filter = document.createElement("select");

                    //country dropdown on access control page should have different style
                    if (filter_info["filterMethod"] != "country") {
                        dropdown_filter.className = "resources_filter_select";
                    }
                    else {
                        dropdown_filter.className = "resources_filter_select_country";
                    }
                    dropdown_filter.id = "acc_filter_" + table_data.captions[i]["identifier"];

                    if (filter_width != "") {
                        dropdown_filter.style.width = filter_width;
                    }

                    Event.observe( dropdown_filter, 'change', filter_action.bindAsEventListener(this, dropdown_filter, i), false);

                    var widget_obj       = acc_table.tmp_objects[i];
                    var arr_opt_groups   = widget_obj.getFilterOpts(i);

                    var filterParams = new Array();
                    filterParams = filter_info["params"];

                    for (var k = 0; k < arr_opt_groups.length; k++) {
                        var opt_group = document.createElement("optgroup");
                        opt_group.label = arr_opt_groups[k]['long'];

                        for (var j = 0; j < filterParams.length; j++ ) {
                            var option_filter = document.createElement("option");

                            if ( filter_info["values"] != undefined && typeof filter_info["values"][j] != "undefined") {
                                option_filter.setAttribute("value", arr_opt_groups[k]['short'] +'|'+ filter_info["values"][j]);
                            }
                            if ( typeof filter_info["filterStyles"] != "undefined" && filter_info["filterStyles"][j] != "") {
                                option_filter.className = filter_info["filterStyles"][j];
                            }

                            if (filter_info["filterMethod"] == "country") {
                                option_filter.className = "resources_filter_option_country";
                                if ( j != 0) {
                                    var country_code = country_mapping_hash_reverse[filterParams[j]];
                                    option_filter.style.backgroundImage = 'url(core/img/flags/flag_' +country_code+'.png)';
                                }
                            }

                            if (option_filter.value == filter_value) {
                                option_filter.selected = "selected";
                            }

                            var text_option   = document.createTextNode(filterParams[j]);
                            option_filter.appendChild(text_option);
                            opt_group.appendChild(option_filter);

                        } // end of inner loop
                        //dropdown_filter.appendChild(option_filter);
                        dropdown_filter.appendChild(opt_group);

                    } // end of outer loop

                    //td_filter.appendChild(dropdown_filter);
                    td_filter.appendChild(dropdown_filter);
                }
            }
            tr_filter.appendChild(td_filter);
        }
        return tr_filter;
    },

    /** checks the caption data if a filter Width is specified and returns it
    */
    get_filter_width: function(table_data, position) {
        var return_width = "";
        if ( typeof (table_data.captions[position]["filterWidth"]) != "undefined") {
            return_width = table_data.captions[position]["filterWidth"];
        }
        return return_width;
     },

     /** checks the caption data if a filter value is specified and returns it
    */
    get_filter_value: function(table_data, position) {
        var return_value = "";
        if ( typeof (table_data.captions[position]["filterValue"]) != "undefined") {
            return_value = table_data.captions[position]["filterValue"];
        }
        return return_value;
     },

    /**
      *  saves all the relevant submitted data in the data storage
     **/
    save_data_in_data_storage: function(structure_data, main_data, info_data, id, arr_index) {

        for (var j = 0; j < structure_data.length; j++) {
            this.data_storage[j][id] = new Array();
            this.tmp_objects[j].saveData(this, main_data, info_data, id, j, arr_index);
        }
    },

    /**
      * creates an tr element with content used for one normal line
      * main_data is empty, the data is got from the data storage
     **/
    create_normal_tr_element: function(structure_data, image_path, td_style, id) {
        var tr_element = document.createElement("tr");
        tr_element.setAttribute("id", "tr_" + id);

        Event.observe(tr_element,'mouseover', this.highlight_table_line.bindAsEventListener(this, tr_element));

        Event.observe(tr_element, 'mouseout', this.remove_line_highlight.bindAsEventListener(this, tr_element));

        Event.observe(tr_element, 'click', this.activate_checkbox.bindAsEventListener(this, tr_element));

        if ( typeof this.options.show_details == 'undefined' || this.options.show_details != 0) {
            Event.observe(tr_element, 'dblclick', this.show_detail_view.bindAsEventListener(this, tr_element));
        }
        for (var j = 0; j < structure_data.length; j++) {

            //create the tds and fill them with the relevant data
            var td_element = document.createElement("td");
            td_element.className = td_style;
            td_element.setAttribute("id", structure_data[j].identifier + "_" + id);

            if (typeof(structure_data[j].align) != "undefined") {
                td_element.style.textAlign = structure_data[j].align;
            }
            td_element.appendChild(this.tmp_objects[j].getDataDraw(this, j, id));

            if (typeof structure_data[j].hidden != "undefined" && structure_data[j].hidden == 1) {
                td_element.style.display = "none";
            }

             tr_element.appendChild(td_element);
        }
        return tr_element;
    },

    /**
     * gets the data out of a  data structur with a specified id and path
    **/
    get_data_from_path: function(id, json_data, path) {
        var id_object = '';
        if (inner_key_exists(json_data, ['result', 'objs', id, 'data'])) {
            id_object = json_data.result.objs[id].data;
        }
        else if ( inner_key_exists(json_data, ['result', id])) {
            //used for the configuration vpn page;
            id_object = json_data.result[id];
        }

        for (var i = 0; i < path.length; i++) {
            if (id_object[path[i]] != undefined) {
                id_object = id_object[path[i]];
            }
            else {
                id_object = "";
                break;
            }
        }
        return id_object;
    },

    getBrowseTable: function() {

    var table_el = document.createElement("table");
    var tb1      = document.createElement("tbody");
    var tr1      = document.createElement("tr");

    var td0 = document.createElement("td");
        td0.setAttribute("id", "td_browse_0");
        td0.setAttribute("width", "600");
        td0.setAttribute("align", "left");

    var td1      = document.createElement("td");
        td1.appendChild(this.getButton_withoutImage("<<"));
    var td2      = document.createElement("td");
        td2.appendChild(this.getButton_withoutImage(">>"));

    var tr2      = document.createElement("tr");

    var td3 = document.createElement("td");
        td3.setAttribute("width", "600");
        td3.setAttribute("align", "left");

    var td4 = document.createElement("td");
        td4.colSpan = 2;
        td4.setAttribute("align", "center");
        td4.setAttribute("id", "td_browsebutton_text");

    var high_value = this.options.max_tr_elements;

    if (this.options.arr_ids.length < high_value) {
        high_value = this.options.arr_ids.length;
    }

    var text_element1 = document.createTextNode( this.tr_displayed.low + " - " + high_value + " of " + this.options.arr_ids.length);

        //appending the elements
        tr1.appendChild(td0);
        tr1.appendChild(td1);
        tr1.appendChild(td2);
        tb1.appendChild(tr1);

        tr2.appendChild(td3);
        td4.appendChild(text_element1);
        tr2.appendChild(td4);
        tb1.appendChild(tr2);
        table_el.appendChild(tb1);

        return table_el;
    },

    /**
    * builds up an html table with a combobox and the buttons needed for browsing
    * calls get asgButton
    **/
    getOptionBrowseTable: function() {

        var table_element = document.createElement("table");
            table_element.className = "resources_browsing_table";
            table_element.setAttribute("cellspacing", "0");

        var tbody_element = document.createElement("tbody");
        var tr_element1 = document.createElement("tr");

        var td_element0 = document.createElement("td");
            td_element0.setAttribute("width", "600");
            td_element0.setAttribute("align", "left");

        var arr_option_text = [
            0,
            10,
            20,
            30,
            40,
            50,
            60
        ];

        var option_element;

        var select_element0 = document.createElement("select");
            select_element0.setAttribute("size", "1");
            select_element0.setAttribute("id", "resources_sorting_option" );
            select_element0.onchange = this.adjust_resorting;

        for (var i = 0; i < arr_option_text.length; i++) {
                option_element = document.createElement("option");
                option_element.setAttribute("value", arr_option_text[i]);

                if ( i != 0) {
                    var option_text = document.createTextNode(
                    "resort every " + arr_option_text[i] + " sec.");
                }
                else {
                    var option_text = document.createTextNode("No automatic sorting");
                }
                option_element.appendChild(option_text);
                select_element0.appendChild(option_element);
        }

        td_element0.appendChild(select_element0);
        tr_element1.appendChild(td_element0);

        var td_element1 = document.createElement("td");

            td_element1.appendChild(this.getButton_withoutImage("<<"));
            tr_element1.appendChild(td_element1);

        var td_element2 = document.createElement("td");
            td_element2.appendChild(this.getButton_withoutImage(">>"));
            tr_element1.appendChild(td_element2);

        var tr_element2 = document.createElement("tr");

        var td_element3 = document.createElement("td");
            td_element3.setAttribute("width", "600");
            tr_element2.appendChild(td_element3);

        var td_element4 = document.createElement("td");
            td_element4.colSpan = 2;
            td_element4.setAttribute("align", "center");
            td_element4.setAttribute("id", "td_browsebutton_text");

        var high_value = this.options.max_tr_elements;

        if (this.options.arr_ids.length < high_value) {
            high_value = this.options.arr_ids.length;
        }

        var text_element1 = document.createTextNode( this.tr_displayed.low + " - " + high_value + " of " + this.options.arr_ids.length);

        td_element4.appendChild(text_element1);
        tr_element2.appendChild(td_element4);

        tbody_element.appendChild(tr_element1);
        tbody_element.appendChild(tr_element2);
        table_element.appendChild(tbody_element);

        return table_element;
    },

    /*
    * builds up the html structure for a button without an text and two images
    * on it
    */
    getBrowseButton_Construct: function(button_name) {

        var id;
        var className;
        var table_ref = this;
        var img_path = "wfe/acc/img/icons/";
        var class_ext = "";

        className = "browse_button";

        if (browser == "ie") {
            class_ext = "_ie";
        }

        var table_element1 = document.createElement("table");
        table_element1.setAttribute("cellspacing", 0);


        var tbody_element1 = document.createElement("tbody");

        var tr_element1 = document.createElement("tr");

        var td_element1 = document.createElement("td");
        td_element1.className = "resources_button_construct_normal_td";

        var span_img1 = document.createElement("span");
        span_img1.id = "button_browse_back";

        span_img1.onclick = function() { table_ref.previous_page()};
        span_img1.className = "button_construct_browse1" + class_ext;

        var img_obj1  = document.createElement("img");
        img_obj1.src = img_path + "move_left.gif";
        span_img1.appendChild(img_obj1);

        var span_line1 = document.createElement("span");
        span_line1.className = "button_construct_line1";

        var span_text1 = document.createElement("span");
        span_text1.className = "button_construct_browse2" + class_ext;
        span_text1.id = "td_browsebutton_text";

        var high_value = this.options.max_tr_elements;

        if (this.options.arr_ids.length < high_value) {
            high_value = this.options.arr_ids.length;
        }

        var text_obj1 = document.createTextNode( this.tr_displayed.low + " - " + high_value + " of " + this.options.arr_ids.length);

        span_text1.appendChild(text_obj1);

        var span_line2 = document.createElement("span");
        span_line2.className = "button_construct_line2";


        var span_img2 = document.createElement("span");
        span_img2.id = "button_browse_forward";
        span_img2.onclick = function() { table_ref.next_page()};
        span_img2.className = "button_construct_browse3" + class_ext;


        var img_obj2  = document.createElement("img");
        img_obj2.src = img_path + "move_right.gif";
        span_img2.appendChild(img_obj2);

        table_element1.setAttribute("id", id);
        table_element1.className = className;


        td_element1.appendChild(span_img1);
        td_element1.appendChild(span_line1);
        td_element1.appendChild(span_text1);
        td_element1.appendChild(span_line2);
        td_element1.appendChild(span_img2);

        tr_element1.appendChild(td_element1);
        tbody_element1.appendChild(tr_element1);
        table_element1.appendChild(tbody_element1);


        return table_element1;
    },

    /*
    * builds up the html structure of a button in asg design
    * and returns it
    */
    getButton_withoutImage: function(button_name) {

        var id;
        var className;
        var table_ref = this;

        var table_element1 = document.createElement("table");
        table_element1.setAttribute("cellspacing", 0);

        if (browser == "ie") {
            table_element1.style.filter = "alpha(opacity= " + this.ie_opacity + ")";
        }
        else {
            table_element1.setAttribute("style", "opacity: " +this.ff_opacity );
        }

        var tbody_element1 = document.createElement("tbody");

        var tr_element1 = document.createElement("tr");

        var td_element1 = document.createElement("td");
        td_element1.className = "resources_button_normal_td";

        switch (button_name) {
            case "<<" :
            //td_element1.onclick = function() { previous_page()};
            id = "button_browse_back";
            className = "browse_button";
            td_element1.onclick = function() { table_ref.previous_page()};
            break;

            case ">>" :
            td_element1.onclick = function() { table_ref.next_page()};
            id = "button_browse_forward";
            className = "browse_button";
            break;

            case "<" :
            id = "button_browse_back";
            className = "browse_button";
            td_element1.onclick = function() { go_previous() };
            var index = acc_table.options.arr_ids.indexOf(acc_details.options.arr_ids[0]);
            if (index > 0) {
                this.set_button_opacity(table_element1, 1);
            }
            break;

            case ">" :
            id = "button_browse_back";
            className = "browse_button";
            td_element1.onclick = function() { go_next() };
            var index = acc_table.options.arr_ids.indexOf(acc_details.options.arr_ids[0]);
            if (index != -1 && index < (acc_table.options.arr_ids.length - 1)) {
                this.set_button_opacity(table_element1, 1);
            }
            break;

            default:
            id = "button_" + button_name.toLowerCase();
            className = "acc_button";
        }

        var span_element1 = document.createElement("span");
        span_element1.className = "resources_button_span";


        var text_element1 = document.createTextNode(button_name);
        table_element1.setAttribute("id", id);
        table_element1.className = className;

        //appending all elements:
        span_element1.appendChild(text_element1);
        td_element1.appendChild(span_element1);
        tr_element1.appendChild(td_element1);
        tbody_element1.appendChild(tr_element1);
        table_element1.appendChild(tbody_element1);

        return table_element1;

    },

    /**
    * builds up an html table with buttons and returns the table
    * calls getasgButton
    **/
    getButtonTable: function() {
        var table_element = document.createElement("table");
        table_element.className = "resources_whole_button_table";
        table_element.setAttribute("cellspacing", "0");

        var tbody_element = document.createElement("tbody");
        var tr_element = document.createElement("tr");

        var td_space = document.createElement("td");
        td_space.setAttribute("width", "15");

        tr_element.appendChild(td_space);

        for (var i = 0; i <  this.options.buttons.length; i++) {
            var td_element = document.createElement("td");
            td_element.appendChild(this.getasgButton(this.options.buttons[i].name, this.options.buttons[i].img_src, "acc_button"));

            tr_element.appendChild(td_element);
        }

        tbody_element.appendChild(tr_element);
        table_element.appendChild(tbody_element);

        return table_element;
    },

    /*
    * builds up an html element with buttons, Browsing, Resorting
    * and returns the element
    */
    getHeader: function() {

        //main table build
        var header_div = document.createElement("div");
            header_div.className = "acc_table_header_div";

        var span_corner = document.createElement("span");
            span_corner.className = "acc_table_header_span_corner";
        var corner_image = document.createElement("img");
            corner_image.src = "wfe/acc/img/icons/acc_table_corner_white.png";
            span_corner.appendChild(corner_image);

        //span for an arrow which connects the checkboxes
        var span0 = document.createElement("span");
            span0.className = "acc_table_header_span0";
        var arrow_image = document.createElement("img");
            arrow_image.src = "wfe/acc/img/icons/arrow_checkbox_long.png";
            span0.appendChild(arrow_image);

        var span1 = document.createElement("span");
            span1.className = "acc_table_header_span1";

        var select1 = this.create_actions_dropdown_box();

        span1.appendChild(select1);

        // Button Details
        var span2 = document.createElement("span");
        span2.className = "acc_table_header_span2";

        if (inner_key_exists(this.options, ['buttons',0, 'name'])) {
            span2.appendChild(this.getaccButton(this.options.buttons[0].name, this.options.buttons[0].img_src, "acc_button", this.options.buttons[0].active));
        }

        //Button WebAdmin
        var span3 = document.createElement("span");
        span3.className = "acc_table_header_span3";

        if (this.options.buttons.length == 3) {
            var tmp_div = Builder.node('div',{});
            var img1 = Builder.node('img', {
                'src' : this.options.buttons[1].img_path +
                this.options.buttons[1].img_src,
                'style'  : 'float:left; padding: 2px 2px 2px 6px; cursor:pointer;',
                'id' : 'odr_button_export_' + this.options.buttons[1].name
            });
            var img2 = Builder.node('img', {
                'src' : this.options.buttons[2].img_path +
                 this.options.buttons[2].img_src,
                'style'  : 'padding: 2px 2px 2px 2px; cursor: pointer;',
                'id' : 'odr_button_export_' + this.options.buttons[2].name
            });
            Element.setOpacity(img1, this.ff_opacity);
            Element.setOpacity(img2, this.ff_opacity);
            Event.observe(img1, 'click', this.odr_export.bindAsEventListener(
            this, img1), false);
            Event.observe(img2, 'click', this.odr_export.bindAsEventListener(
            this, img2), false);
            tmp_div.appendChild(img1);
            tmp_div.appendChild(img2);
            span3.appendChild(tmp_div);
        }
        else if (inner_key_exists(this.options, ['buttons',1, 'name'])) {
            span3.appendChild(this.getaccButton(
                this.options.buttons[1].name,
                this.options.buttons[1].img_src,
                "acc_button",
                this.options.buttons[1].active)
            );
        }

        //Table
        var span3a = this.create_display_dropdown();

        // Resorting Dropdown Field
        var span4 = document.createElement("span");
        span4.className = "acc_table_header_span4";

        var arr_option_text = [
            0,
            10,
            20,
            30,
            40,
            50,
            60
        ];

        var select_element0  = document.createElement("select");
        select_element0.className = "acc_dropdown_select_resort";
        select_element0.setAttribute("size", "1");
        select_element0.setAttribute("id", "resources_sorting_option" );
        select_element0.onchange = this.adjust_resorting;

        for (var i = 0; i < arr_option_text.length; i++) {
            var option_element = document.createElement("option");
            option_element.className = "acc_dropdown_option_button";
            option_element.setAttribute("value", arr_option_text[i]);

            if ( i != 0) {
                var option_text = document.createTextNode("resort every " + arr_option_text[i] + " sec.");
            }
            else {
                var option_text = document.createTextNode("::Automatic Sorting::");
            }
            option_element.appendChild(option_text);
            select_element0.appendChild(option_element);
        }

        span4.appendChild(select_element0);

        var span5 = document.createElement("span");
        span5.className = "acc_table_header_span5";

        var span6 = document.createElement("span");
        span6.className = "acc_table_header_span6";

        span5.appendChild(this.getBrowseButton_Construct(""));

        //append all Elements
        header_div.appendChild(span_corner);
        header_div.appendChild(span0);
        header_div.appendChild(span1);
        header_div.appendChild(span2);
        header_div.appendChild(span3);
        header_div.appendChild(span3a);
        header_div.appendChild(span4);
        header_div.appendChild(span5);

        return header_div;
    },

    /**
    * builds up the html structure of a button used for the upper table line
    * and returns it
    **/
    getaccButton: function(button_name, image_name, button_style, active) {

        if (typeof button_style == "undefined") {
            button_style = "acc_button";
        }

        if (typeof active == "undefined") {
            active = 0;
        }

        var id;
        var className;
        var table_ref = this;

        // get the Path to the Images:
        var img_path = this.options.image_path;

        if (typeof(image_name) == "undefined") {
            image_name = "core/img/icons/check.png";
        }
        else {
            image_name = img_path + image_name;
        }

        var t1 = document.createElement("table");
        t1.className = button_style;
        t1.setAttribute("id", "button_" + button_name.toLowerCase());
        t1.style.textAlign = "right";

        if (browser == "ie" && button_style == "acc_button" ) {
            if (active != 0) {
                t1.style.filter = "alpha(opacity=100)";
            }
            else  {
                t1.style.filter = "alpha(opacity=" + this.ie_opacity +")";
            }
        }
        else if (button_style == "acc_button") {
            if (active != 0) {
                t1.setAttribute("style", "opacity: 1");
            }
            else {
                t1.setAttribute("style", "opacity: " + this.ff_opacity);
            }
        }

        var tb1 = document.createElement("tbody");

        var tr1 = document.createElement("tr");

        var td1 = document.createElement("td");
        td1.className = "resources_td_image";

        var div1 = document.createElement("div");
        div1.setAttribute("align", "center");

        var t2 = document.createElement("table");
        t2.className = "resources_button_inner_table";

        var tb2 = document.createElement("tbody");

        var tr2 = document.createElement("tr");

        var td2 = document.createElement("td");

        var img1 = document.createElement("img");
        img1.className = "resources_button_image";
        img1.src = image_name;

        var td3 = document.createElement("td");
        td3.setAttribute("style", "width:2px");

        var td4 = document.createElement("td");
        td4.className = "resources_acc_button_td";

        var text1 = document.createTextNode(button_name);
        switch (button_name) {

            case "Reboot" :
            t1.onclick = function() { acc_table.reboot_device(this) }
            break;

            case "Shutdown" :
            t1.onclick = function() { acc_table.shutdown_device(this) }
            break;

            case "Up2Date" :
            t1.onclick = function() { acc_table.up2date(this) }
            break;

            case "WebAdmin" :
            if (this.options.name.toLowerCase().indexOf("details") != -1) {
                t1.onclick = function() { acc_details.commit_device_sso(this) }
            }
            else {
                t1.onclick = function() { acc_table.commit_device_sso(this) }
            }
            break;

            case "Details" :
            t1.onclick = function() { show_details() };
            break;

            case "Create" :
            this.check_for_table_rights(t1);
            t1.onclick = function() { acc_table.open_wizard(acc_table.get_checked_ids())};
            break;

            case "Back" :
            t1.onclick = function() { go_back() };
            this.set_button_opacity(t1, 1);
            break;

            default:
            break;
        }

        //appending all elements
        td2.appendChild(img1);
        tr2.appendChild(td2);

        tr2.appendChild(td3);

        td4.appendChild(text1);
        tr2.appendChild(td4);

        tb2.appendChild(tr2);
        t2.appendChild(tb2);
        div1.appendChild(t2);
        td1.appendChild(div1);
        tr1.appendChild(td1);
        tb1.appendChild(tr1);
        t1.appendChild(tb1);

        return t1;
    },

    /**
    * creates the HTML Structure of a small button with one image
    */
    getSmallImgButton : function(button_name, image_name, button_style, class_ext) {
        // get the Path to the Images:
        var img_path = this.options.image_path;

        var t1 = document.createElement("table");
        t1.setAttribute("cellpadding", 0);
        t1.setAttribute("cellspacing", 0);
        t1.className = button_style +  class_ext;
        t1.setAttribute("id", "button_" + button_name.toLowerCase());

        var tb1 = document.createElement("tbody");

        var tr1 = document.createElement("tr");

        var td1 = document.createElement("td");
        td1.className = "resources_td_image";

        var img1 = document.createElement("img");
        img1.className = "table_img_sort_switch" + class_ext;
        img1.src = img_path + image_name;

        //append all elements
        td1.appendChild(img1);
        tr1.appendChild(td1);
        tb1.appendChild(tr1);
        t1.appendChild(tb1);

        return t1;
    },

    /**
    * builds up the html structure of a button in asg design
    * and returns it
    */
    getasgButton: function(button_name, image_name, button_style) {

        if (typeof button_style == "undefined") {
            button_style = "asg_button";
        }

        var id;
        var className;
        var table_ref = this;

        // get the Path to the Images:
        var img_path = this.options.image_path;

        if (typeof(image_name) == "undefined") {
            image_name = "core/img/icons/check.png";
        }

        else {
            image_name = img_path + image_name;
        }

        var t1 = document.createElement("table");
        t1.className = button_style;
        t1.setAttribute("id", "button_" + button_name.toLowerCase());
        t1.style.textAlign = "right";

        if (browser == "ie" && button_style == "acc_button") {
            t1.style.filter = "alpha(opacity=" + this.ie_opacity +")";
        }
        else if (button_style == "acc_button") {
            t1.setAttribute("style", "opacity: " + this.ff_opacity);
        }

        var tb1 = document.createElement("tbody");

        var tr1 = document.createElement("tr");

        var td1 = document.createElement("td");
        td1.className = "resources_td_image";

        var div1 = document.createElement("div");
        div1.setAttribute("align", "center");

        var t2 = document.createElement("table");
        t2.className = "resources_button_inner_table";

        var tb2 = document.createElement("tbody");

        var tr2 = document.createElement("tr");

        var td2 = document.createElement("td");

        var img1 = document.createElement("img");
        img1.className = "resources_button_image";
        img1.src = image_name;

        var td3 = document.createElement("td");
        td3.setAttribute("style", "width:2px");

        var td4 = document.createElement("td");
        td4.className = "resources_button_td";

        var text1 = document.createTextNode(button_name);

        switch (button_name) {

            case "Reboot" :
            td1.onclick = function() { acc_table.reboot_device(this) }
            break;

            case "Shutdown" :
            td1.onclick = function() { acc_table.shutdown_device(this) }
            break;

            case "Up2Date" :
            td1.onclick = function() { acc_table.up2date(this) }
            break;

            case "WebAdmin" :
            td1.onclick = function() { acc_table.commit_device_sso(this) }
            break;

            case "Details" :
            td1.onclick = function() { show_details() };
            break;

            case "Back" :
            td1.onclick = function() { go_back() };
            this.set_button_opacity(t1, 1);
            break;

            default:
            break;
        }

        //appending all elements
        td2.appendChild(img1);
        tr2.appendChild(td2);

        tr2.appendChild(td3);

        td4.appendChild(text1);
        tr2.appendChild(td4);

        tb2.appendChild(tr2);
        t2.appendChild(tb2);
        div1.appendChild(t2);
        td1.appendChild(div1);
        tr1.appendChild(td1);
        tb1.appendChild(tr1);
        t1.appendChild(tb1);

        return t1;

    },

    /**
    * sorts the data of the table on a column_name specified
    * @params change (boolean), should the sort direction been changed
    */
    sort_column: function(new_column_name, change) {
        //should the sort direction be changed?
        if ( new_column_name == this.last_column_sorted.column_name && change ) {
            if ( this.last_column_sorted.direction == "up") {
                this.last_column_sorted.direction = "down";
            }
            else {
                this.last_column_sorted.direction = "up";
            }
            this.column_changed = false;
            this.change_caption_arrows();
        }

        // should the sorting start with a different column
        if (new_column_name != this.last_column_sorted.column_name) {

            //change the arrow image from one column to another
            this.switch_arrow_image( this.last_column_sorted.column_name, new_column_name, this.last_column_sorted.direction);

            this.last_column_sorted.column_name = new_column_name;

            this.change_caption_arrows();
            this.column_changed = true;
        }

        //reset updated variable after sorting to stop resorting
        this.updated = false;

        //start the sorting procedure
        // only sort the devices, if there are some devices
        if (this.options.arr_ids.length > 0) {
            this.options.arr_ids = this.options.arr_ids.sort(this.acc_table_compare);

            //enable next sorting on reporting pages
            this.sorting_started = false;

            //reverse the array if sort direction is "down"
            if (this.last_column_sorted.direction == "down") {
                this.options.arr_ids.reverse();
            }

            //call the function to change the order of the elements
        }

        this.regroup_trs();

        // check if we need to hide tooltip
        if (this.options.arr_ids.indexOf(this.tooltipId) == -1 || this.options.arr_ids.indexOf(this.tooltipId) != this.tooltipRow) {
            this.hide_tooltip();
        }

        // sort the slideshow data if it exists
        if ( typeof this.options.full_slideshow_data != 'undefined') {
            this.sort_slideshow_data();
        }
    },

    /**
    * called from the method sort_column, used as a compare function for two values
    *
    * Provides three kinds of sorting:
    * 1. If given widget has getSortValue function defined, gets values to sort from this function.
    * Otherwise gets values from data_strage, depending on sortindex:
    * 2. If sortindex is a number, just sort on one value (path)
    * 3. If sortindex is an array, sorts on multiple values (coming from multiple paths)
    */
    acc_table_compare: function(a, b, order) {

        // indicates if we sort on one or more values
        var multiSort = false;

        if (typeof(order) == "undefined") {
            order = 0;
        }

        //get the array index which column is used
        var index_num = 0;
        var caption_element = $("captions_" + acc_table.last_column_sorted.column_name);

        if (caption_element != undefined) {
            index_num = parseInt(caption_element.getAttribute("index"));
        }

        if (typeof(acc_table.tmp_objects[index_num].getSortValue) == "function") {
            var value_a = acc_table.tmp_objects[index_num].getSortValue(a, index_num);
            var value_b = acc_table.tmp_objects[index_num].getSortValue(b, index_num);
        }
        else {
            //get the sort index, which widget value should be taken for sorting
            if (typeof(acc_table.options.captions[index_num].sortindex) == "number") {
                var sortindex = acc_table.options.captions[index_num].sortindex;
            }
            else {
                multiSort = true;
                var sortindex = acc_table.options.captions[index_num].sortindex[order];
            }

            // create the values for the comparison
            var column_arr = acc_table.data_storage[index_num];

            var value_a = column_arr[a][sortindex];
            var value_b = column_arr[b][sortindex];
        }

        if (typeof value_a == "string") {
            value_a = value_a.toLowerCase();
        }

        if (typeof value_b == "string") {
            value_b = value_b.toLowerCase();
        }

        var return_value;

        if (multiSort && value_a == value_b && order < acc_table.options.captions[index_num].sortindex.length) {
            return_value = acc_table.acc_table_compare(a, b, order + 1);
        }
        else {
            return_value = acc_table.get_compare_result(value_a, value_b, a, b);
        }
        return return_value;
    },

    /**
    * called for sorting by acc_table_compare function,
    * checks which of the given parameters are higher
    */
    get_compare_result: function(value_a, value_b, id_a, id_b) {
        var return_value = 0;

        if ( value_a > value_b) {
            return_value = 1;
        }
        else if ( value_a == value_b) {
            if (id_a > id_b) {
                return_value = 1;
            }
            else if (id_a < id_b) {
                return_value = -1;
            }
            else {
                return_value = 0;
            }
        }
        else if (value_a < value_b) {
            return_value = -1 ;
        }
        return return_value;
    },

    /**
    *  function called to change the arrow images in the caption line
    *  from up to down an vice versa
    */
    change_caption_arrows: function() {
        //get the image path:
        var image_path = this.options.image_path;

        //get the caption array:
        var captions_arr = this.options.captions;

        if ( this.last_column_sorted.direction == "up" ) {
            if ( browser == "ie" && browser_version == "6" ) {
                var image_src = image_path + "arrow_down.gif";
            }
            else {
                var image_src = image_path + "arrow_down.png";
            }
        }
        else if( this.last_column_sorted.direction == "down" ) {
            if ( browser == "ie" && browser_version == "6" ) {
                var image_src = image_path + "arrow_up.gif";
            }
            else {
                var image_src = image_path + "arrow_up.png";
            }
        }

        for (var i = 0; i < this.options.captions.length; i++) {
            try {
                var img_element = $("caption_img_" + this.options.captions[i].identifier);
                img_element.src = image_src;
            }
            catch(e) {
                continue;
            }
        }
    },

    /**
    * function which switches an arrow image from one column to another
    */
    switch_arrow_image: function( old_column, new_column, sort_direction) {
        try {
            // get the Path to the Images:
            var img_path = this.options.image_path;

            // first step hide the arrow of the old column
            $("caption_img_td_" + old_column).removeChild($("caption_img_" + old_column));

            // second step show the arrow of the new column
            td_el2 = $("caption_img_td_" + new_column);

            var img_el = document.createElement("img");
            if (browser == "ie") {
                img_el.setAttribute("src",  img_path + "arrow_down.gif");
            }
            else {
                img_el.setAttribute("src",  img_path + "arrow_down.png");
            }
            img_el.setAttribute("id", "caption_img_" + new_column);
            td_el2.appendChild(img_el);
            td_el2.style.visibility = "visible";
        }
        catch(e) {}
    },

    /**
    * called, after a sorting procedure has finished, reorders the tr elements
    * if the tr element exits its moved to its new position, if it doesn't exist
    * a new one is created with the data of the data storage and placed at its new
    * position
    */
    regroup_trs: function() {
        var child_index = 1;

        if (this.filter) {
            var child_index = 2;
        }

        var main_table_element = $('acc_table_'+this.options.name+'_items');

        if (main_table_element != undefined) {
            var main_tbody_element = main_table_element.firstChild;

            var td_style = this.options.table_styles.td_style1;

            //remove all trs from the table which aren't the caption and the filter
            while (main_tbody_element.childNodes.length > child_index) {
                main_tbody_element.removeChild(main_tbody_element.childNodes[child_index]);
            }

            //build up the new table
            if ( this.tr_displayed.low < 1 ) {
                this.tr_displayed.low = 1;
            }

            for (var i = this.tr_displayed.low -1; i < this.tr_displayed.high; i++) {
                var td_style = this.options.table_styles.td_style1;
                if ( i % 2 == 1 ) {
                    td_style = this.options.table_styles.td_style2;
                }
                var tr_element = this.data_storage_to_tr(this.options.arr_ids[i], td_style);
                main_tbody_element.appendChild(tr_element);
            }
        }
    },

    /**
    * changes tr styles to alternating colors
    */
    recolor_tds: function() {

        // switch the tr style alternating
        for ( var i = 0; i < this.options.arr_ids.length; i++ ) {
            for( var j = 0; j < this.options.captions.length; j++ ) {
                var td_element = $( this.options.captions[j].identifier + "_" + this.options.arr_ids[i]);
                if (td_element != undefined) {
                    if (i % 2 == 0) {
                        td_element.className = this.options.table_styles.td_style1;
                    }
                    else {
                        td_element.className = this.options.table_styles.td_style2;
                    }
                }
            }
        }
    },

    /**
    * gets the data out of the data storage and creates the html structure for a tr
    * returns the tr element
    */
    data_storage_to_tr: function( id, td_style) {
        var tr_element = this.create_normal_tr_element(this.options.captions, this.options.image_path, td_style, id);
        return tr_element;
    },

    /**
    * called when forward browsing button is clicked, displayes the next devices
    */
    next_page:function() {
        var number_of_elements = this.options.arr_ids.length - this.tr_displayed.high;

        if (number_of_elements >= this.options.max_tr_elements) {
            this.tr_displayed.low  += this.options.max_tr_elements;
            this.tr_displayed.high += this.options.max_tr_elements;
            number_of_elements = this.options.max_tr_elements;
        }
        else if (number_of_elements < this.options.max_tr_elements && number_of_elements > 0) {
            this.tr_displayed.low  += this.options.max_tr_elements;
            this.tr_displayed.high += number_of_elements;
        }

        if (number_of_elements > 0) {
            var details_reg_exp = new RegExp( "details", "i");
            if (! details_reg_exp.exec(this.options.name)) {
                this.disable_actions_dropdown();
            }

            //update the browsebutton text
            this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);

            //set the opacitiy of the browse_buttons
            this.set_browse_button_opacity(this.options.arr_ids.length);

            //deactivate the buttons
            this.change_button_status( this.ff_opacity, 0);

            //clear the trs in the table
            this.clear_all_trs();

            // create the new table rows and append it
            for (var i = 0; i < number_of_elements; i++) {
                // find out the id of the table element
                var index_num = this.tr_displayed.low -1 + i;
                var id = this.options.arr_ids[index_num];

                if ( i % 2 == 0) {
                    var td_style = this.options.table_styles.td_style1;
                }
                else {
                    var td_style = this.options.table_styles.td_style2;
                }
                var tr_element = this.data_storage_to_tr(id, td_style);

                var master_td_element = $("acc_table_" + this.options.name + "_items");
                master_td_element.firstChild.appendChild(tr_element);
            }
        }
    },

    /**
    * checks which opacity values for the browse buttons are necessary
    * and sets them
    */
    set_browse_button_opacity: function(sum) {
        // check if there are more than one page
        if ( sum <= this.options.max_tr_elements) {
            this.set_button_opacity("button_browse_back", this.ff_opacity);
            this.set_button_opacity("button_browse_forward", this.ff_opacity);
        }

        //more than one page
        else {
            // first page
            if (this.tr_displayed.low < this.options.max_tr_elements) {
                this.set_button_opacity("button_browse_back", this.ff_opacity);
                this.set_button_opacity("button_browse_forward", 1);
            }
            // last page
            else if (this.tr_displayed.high == sum) {
                this.set_button_opacity("button_browse_back", 1);
                this.set_button_opacity("button_browse_forward", this.ff_opacity);
            }
            // middle page
            else {
                this.set_button_opacity("button_browse_back", 1);
                this.set_button_opacity("button_browse_forward", 1);
            }
        }
    },

    /**
    * changes the opacity of a specific button
    */
    set_button_opacity: function(id, opacity) {
        try {
            var button = new Object();
            if ( typeof (id) == "object") {
                button = id;
            }
            else {
                button = $(id);
            }

            if (browser == "ie") {
                if (opacity < 1) {
                    button.style.filter = "alpha(opacity= " + this.ie_opacity + ")";
                }
                else  {
                    button.style.filter = "alpha(opacity=100)";
                }
            }
            else {
                button.style.opacity = opacity;
            }
        }

        catch(e){}
    },

    /**
    * removes all trs in the table, but keeps the caption line
    */
    clear_all_trs : function() {
        var master_td_element = $("acc_table_" + this.options.name + "_items");
        var caption_element = $("tr_caption");

        var tbody_element = master_td_element.firstChild.cloneNode(false);
        tbody_element.appendChild(caption_element);

        if (this.filter) {
            var filter_element = $("tr_filter");
            tbody_element.appendChild(filter_element);
        }
        master_td_element.removeChild(master_td_element.firstChild);
        master_td_element.appendChild(tbody_element);
    },

    /**
    * updates the text which is displayed under the two browsing buttons
    */
    update_browsebutton_text : function( low, high, sum) {
        var new_text;

        if (low > high) {
            new_text = 0 + " of " + sum;
        }
        else {
            new_text = low + " - " + high + " of " + sum;
        }
        var browsebutton_td = $("td_browsebutton_text");
        if (browsebutton_td != undefined) {
            browsebutton_td.innerHTML = new_text;
        }
    },

    /**
    * called when backward browsing button is called, displayes the previous devices
    */
    previous_page: function() {

        //checking if browsing is necessary
        if (this.tr_displayed.low > this.options.max_tr_elements) {
            var details_reg_exp = new RegExp( "details", "i");
            if (! details_reg_exp.exec(this.options.name)) {
                this.disable_actions_dropdown();
            }

            //first step update low and high index
            this.tr_displayed.low  -= this.options.max_tr_elements;
            this.tr_displayed.high =  this.tr_displayed.low + this.options.max_tr_elements - 1;

            //update of browse buttons text
            this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);

            //set the opacitiy of the browse_buttons
            this.set_browse_button_opacity(this.options.arr_ids.length);

            //deactivate the buttons
            this.change_button_status( this.ff_opacity, 0);

            //clear the trs in the table
            this.clear_all_trs();

            //create and append the trs
            for (var i = 0; i < this.options.max_tr_elements; i++) {

                //create id of devices to display
                var index_num = this.tr_displayed.low -1 + i;
                var id = this.options.arr_ids[index_num];

                if ( i % 2 == 0) {
                    var td_style = this.options.table_styles.td_style1;
                }
                else {
                    var td_style = this.options.table_styles.td_style2;
                }

                var tr_element = this.data_storage_to_tr(id, td_style);

                var master_td_element = $("acc_table_" + this.options.name + "_items");
                master_td_element.firstChild.appendChild(tr_element);
            }
        }
    },

    /**
    * called when resorting combo box is changed
    */
    adjust_resorting: function() {
        // checking: is the timeout variable already set
        if( typeof(interval_val) == "undefined") {
            interval_val = "";
        }
        else if (typeof(interval_val) == "number") {
            window.clearInterval(interval_val);
        }

        var option_element = $("resources_sorting_option");

        var selected_time = option_element[option_element.selectedIndex].value * 1000;

        if ( selected_time != 0 ) {
            interval_val = window.setInterval("acc_table.resort()", selected_time);

        }
    },

    /**
    * function called from function adjust_resorting, prepares the data for the
    * sort function and calls it
    */
    resort: function() {
        //prepare data to call the resort function of the table
        if ( this.updated) {
            var column_name = this.last_column_sorted.column_name;
            this.sort_column(column_name, false);
        }
    },

    /**
    * calls the update_tooltip_funtion, when the mouse is moved
    */
    initialize_tooltip: function() {
        document.onmousemove = this.update_tooltip_position;
    },

    /**
    * called when the mouse is moved, moves the tooltip to a position next to the mouse
    */
    update_tooltip_position: function(e) {

        if (!e) {
            //MSIE case
            e = window.event;
            // scrolling in y direction must be taken in consideration
            var x = e.clientX;
            var y = e.clientY + document.documentElement.scrollTop;
        }
        else {
            //rest of browsers
            var x = e.pageX;
            var y = e.pageY;
        }

        tooltip_element = $("resources_tooltip");
        if ( tooltip_element != undefined ) {
            var tooltip_width = 0;

            if (tooltip_element.scrollWidth != undefined && tooltip_element.scrollWidth < 1000) {
                tooltip_width = tooltip_element.scrollWidth;
            }
            else if (tooltip_element.getWidth() != undefined && tooltip_element.getWidth() < 1000) {
                tooltip_width = tooltip_element.getWidth();
            }

            if (browser == "ie") {
                var windowWidth = document.body.clientWidth;

                if (check_for_ie_min_number(8)) {
                    var offset_x = -50;
                }
            }
            else {
                var windowWidth = window.innerWidth;
                var offset_x = 20;
            }

            var diff_x = x + tooltip_width / 2 + offset_x - windowWidth;

            if (diff_x > 0 ) {
                x -= diff_x;
            }

            tooltip_element.style.left = ( x - tooltip_width / 2)  + "px";
            tooltip_element.style.top  = ( y + 20 ) + "px";
        }
    },

    /**
    * changes the style of the tooltip that is shown
    */
    show_tooltip: function(id, mode, part, position) {
        this.tooltipId  = id;
        this.tooltipRow = this.options.arr_ids.indexOf(id);

        switch (mode) {
            case "caption" :
            var new_text = this.get_caption_tooltip_text(id);
            var tooltip_color = "#d9d9d9";
            break;

            case "cardview" :
            var new_text = this.get_cardview_tooltip_text(id, part, position);
            var tooltip_color = "#d9d9d9";
            break;

            case "outdated" :
            var new_text = _LOC("The UTM version is not supported by the current SUM version. Please update the UTM as well as SUM to the latest version.");
            var tooltip_color = "#d9d9d9";
            break;

            default:
            var new_text = this.get_tooltip_text(id, mode);
            var tooltip_color = this.get_tooltip_color( id, mode);
            break;
        }

        if ( new_text != undefined && new_text != "" ) {
            try {
                tooltip_element.style.display = "block";
                tooltip_element.innerHTML = '<div class="tooltip_inside">' + iFrameWorkaround + new_text + '</div>';
                tooltip_element.style.backgroundColor = tooltip_color;
            }
            catch(e) {}
        }
    },

    /**
    * decides using the id, and mode with a call of the widget getTolltipData Method
    * which tooltip text should be displayed and returns it
    **/
    get_tooltip_text: function(id, mode) {
        var tooltip_text = "";

        //get the index from the caption array
        try {
            var caption_element = $("captions_" + mode);
            var main_index = parseInt(caption_element.getAttribute("index"));
            var tooltip_text = this.tmp_objects[main_index].getTooltipData(this, id, main_index);
        }
        catch(e) {}
        return tooltip_text;
    },

    /**
    * decides using the id, and mode with a call of the widget getTolltipColor Method
    * which tooltip color should be displayed and returns it
    **/
    get_tooltip_color: function(id, mode) {
        //get the index from the caption array
        try {
            var caption_element = $("captions_" + mode);
            var main_index = parseInt(caption_element.getAttribute("index"));
            var tooltip_color = this.tmp_objects[main_index].getTooltipColor(this, id, main_index);

            if ( typeof (tooltip_color) == "undefined" || tooltip_color == "") {
                tooltip_color = "#d9d9d9";
            }
        }
        catch(e) {}

        return tooltip_color;
    },

    /**
    * decides using the id, which text of the caption tooltip texts submitted to the table
    * is the right one and returns it
    */
    get_caption_tooltip_text: function(id) {

        var caption_text = "";

        //get the index of the caption array
        var caption_element = $(id);
        var caption_index = parseInt(caption_element.getAttribute("index"));

        //get the text for the caption:
        caption_text = this.options.captions[caption_index].tooltip;

        return caption_text;
    },

    /**
    * decides using the id, which text of the caption tooltip texts submitted to the table
    * is the right one and returns it
    */
    get_cardview_tooltip_text: function(id, part, position) {

        var tooltip_text = "";
        //get the index from the caption array
        try {
            var tooltip_text = this.tmp_objects[position].getTooltipData(this, id, part, position);
        }
        catch(e) {}
        return tooltip_text;
    },

    /**
    * changes the style of the tooltip that it isn't shown
    */
    hide_tooltip: function() {
        this.tooltipId = -1;
        this.tooltipRow = -1;

        try {
            this.tooltip_caller = "";
            tooltip_element.style.display = "none";
        }
        catch(e) {}
    },

    /**
    * moves the tooltip to a element specified by an if
    * @params the id of the element where to place the tooltip
    */
    move_tooltip_to_id: function(target_id, device_id, mode, part, position) {
        tooltip_element = $("resources_tooltip");
        var target = $(target_id);
        if (target != undefined && tooltip_element != undefined && Element.clonePosition != undefined) {
            var cp_config = {
                'setLeft' : true,
                'setTop' : true,
                'setWidth' : false,
                'setHeight' : false,
                'offsetLeft' : 0,
                'offsetTop' : 20
            };
            Element.clonePosition(tooltip_element, target, cp_config);
            this.show_tooltip(device_id, mode, part, position);
        }
    },

    /**
    * deletes a tr of the table out of the view
    * @params the id of the tr to delete
    * updates last_devices variable
    */
    delete_tr: function(id) {
        // remove id from the arr list
        if (this.options.arr_ids.length > 0 && this.options.arr_ids.indexOf(id) != -1) {
            this.options.arr_ids = this.options.arr_ids.without(id);
        }
        last_devices = Object.toJSON(this.options.arr_ids);

        //try to deactivate the actions and buttons
        try {
            this.disable_actions_and_buttons();
        }
        catch(e) {}

        //delete the device from the data storage
        for( var m = 0; m < this.data_storage.length; m++) {
            delete this.data_storage[m][id];
        }

        // update the browsebutton text
        if (this.tr_displayed.high > this.options.arr_ids.length) {
            this.tr_displayed.high = this.options.arr_ids.length;

            //check if all devices in one view are deleted
            if (this.tr_displayed.high < this.tr_displayed.low) {
                //call function to go to the first page
                this.goto_first_page();
            }
        }

        this.set_browse_button_opacity(this.options.arr_ids.length);

        this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);

        try {
            var child_node = $("tr_" + id);
            var parent_node = child_node.parentNode;
            parent_node.removeChild(child_node);

            // change coloring of table
            this.recolor_tds();
        }
        catch(e) {
            _debug("delete_tr: " + e.message);
        }

        this.regroup_trs();
    },

    delete_filter_tr : function(id) {
        this.options.arr_ids = this.options.arr_ids.without(id);

        // update the browsebutton text
        if (this.tr_displayed.high > this.options.arr_ids.length) {
            this.tr_displayed.high = this.options.arr_ids.length;

            //check if all devices in one view are deleted
            if (this.tr_displayed.high < this.tr_displayed.low) {
                //call function to go to the first page
                this.goto_first_page();
            }
        }
        this.set_browse_button_opacity(this.options.arr_ids.length);

        this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);
    },

    add_filter_tr: function(id) {

        // update arr_ids list and global variable last_devices
        this.options.arr_ids.push(id);

        if (this.tr_displayed.high == this.options.arr_ids.length -1 &&  (this.options.arr_ids.length - this.tr_displayed.low) < this.options.max_tr_elements) {
            this.tr_displayed.high = this.options.arr_ids.length;
        }
        else {
            this.set_browse_button_opacity(this.options.arr_ids.length);
        }

        // update the text of the browsebuttons in every case
        this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);
    },

    /**
    * calls previous_page till the first page is reached
    */
    goto_first_page: function () {
        while (this.tr_displayed.low > 1) {
            this.previous_page();
        }
    },

    /**
    * called from perl side, when a notification to add an device comes in
    * saves the data in the data storage and calls the sort function
    */
    insert_tr: function(main_data, device_info, id) {
        _debug("function insert_tr called: " + Object.toJSON(main_data) + "<br>device_info: " + Object.toJSON(device_info) + "<br>id: " + id );

        if (typeof id == "number") {
            id = id.toString();
        }

        if (typeof this.options.arr_ids == "string") {
            this.options.arr_ids = new Array();
        }

        var new_index = this.options.arr_ids.length;

        //next step save the data in the table
        this.save_data_in_data_storage(this.options.captions, main_data, device_info, id, new_index);

        var show_device = this.check_device_filters(id);

        if (last_devices != undefined && last_devices != '' &&last_devices != '""') {
            var arr_last_devices = last_devices.evalJSON();
            last_devices = Object.toJSON(arr_last_devices);
        }

        if (show_device) {
            // update arr_ids  list and global variable last_devices
            this.options.arr_ids.push(id);

            //adjust the variables for browsing
            // case we are at the last page or the first page and
            // there is still space left to insert the device
            // then the opacity of the browse button should not be changed
            if (this.tr_displayed.high == this.options.arr_ids.length -1 &&  (this.options.arr_ids.length - this.tr_displayed.low) < this.options.max_tr_elements) {
                this.tr_displayed.high = this.options.arr_ids.length;
            }
            else {
                this.set_browse_button_opacity(this.options.arr_ids.length);
            }

            // update the text of the browsebuttons in every case
            this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);

            // getting the column name which was sorted last
            var column_param = this.last_column_sorted.column_name;

            //start the resorting of the table
            this.sort_column( column_param, false);
        }
        else {
            //add the element to the hide list
            this.hidden_guids.push(id);
        }
    },

    /** function to add an tr which existed and has been deleted via the filter
    *
    */
    insert_removed_tr: function(id) {
        // update arr_ids  list and global variable last_devices
        this.options.arr_ids.push(id);

        if (this.tr_displayed.high == this.options.arr_ids.length -1 &&  (this.options.arr_ids.length - this.tr_displayed.low) < this.options.max_tr_elements) {
            this.tr_displayed.high = this.options.arr_ids.length;
        }
        else {
            this.set_browse_button_opacity(this.options.arr_ids.length);
        }

        // update the text of the browsebuttons in every case
        this.update_browsebutton_text(this.tr_displayed.low, this.tr_displayed.high, this.options.arr_ids.length);

        // getting the column name which was sorted last
        var column_param = this.last_column_sorted.column_name;

        //start the resorting of the table
        this.sort_column( column_param, false);
    },

    /**
    * checks or unchecks all checkboxes, when the master checkbox is checked
    */
    main_checkbox_changed: function() {
        var checkbox_array = new Array();
        checkbox_array = document.getElementsByClassName("resources_checkbox_style");

        var main_checkbox = $('main_cb_caption_0');

        if (main_checkbox.checked) {
            var checkbox_checked = true;

            if (acc_table.options.arr_ids.length == 1) {
                acc_table.change_button_status(1, 1);
            }
            else if (acc_table.options.arr_ids.length > 1) {
                acc_table.change_button_status(1, 2);
            }
            //change the status of the actions dropdown field
            acc_table.enable_actions_dropdown();
        }
        else {
            var checkbox_checked = false;
            acc_table.change_button_status( acc_table.ff_opacity, 0);

            //disable the action dropdown field
            acc_table.disable_actions_dropdown();
        }

        for (var i = 0 ; i < checkbox_array.length; i++) {
            if (checkbox_checked) {
                checkbox_array[i].checked = "checked";
                acc_table.mark_all_lines(true);
            }
            else {
                checkbox_array[i].checked = null;
                acc_table.mark_all_lines(false);
            }
        }
        //change entries of the actions dropdown field for vpn configuration
        acc_table.change_button_dropdown_entries(acc_table.options.name);

        //change the name of the create/modify button on the vpn configuration page
        acc_table.change_vpn_create_button();
    },

    /**
    * activates the buttons, when a checkbox is checked
    */
    minor_checkbox_changed: function(e) {

        var button_opacity = acc_table.ff_opacity;
        var checkboxes_checked = 0;

        // check if at least one checkbox is checked
        var checkbox_array = new Array();
        checkbox_array = document.getElementsByClassName("resources_checkbox_style");

        for (var i = 0; i < checkbox_array.length; i++) {
            if (checkbox_array[i].checked) {
                button_opacity = 1;
                checkboxes_checked ++;
                if (checkboxes_checked == 2) {
                    break;
                }
            }
        }
        acc_table.change_button_status(button_opacity, checkboxes_checked);

        //change the name of the create/modify button on the vpn configuration page
        this.change_vpn_create_button();
    },

    /**
    * checks or unchecks all checkboxes, when the master checkbox is checked
    * Also checks invisible values which are on other pages of listview
    */
    main_realcheckbox_changed: function(caption_index) {
        // mark flag that there were some changes done
        ac_anyChanges = true;

        var otherIndex = this.get_realcheckbox_indices();
        for (var dev_id in acc_table.data_storage[caption_index]) {
            if (dev_id != "extend" && acc_table.data_storage[caption_index][dev_id][1]) {
                acc_table.data_storage[caption_index][dev_id][0] = $("cb_" + caption_index).checked;
                acc_table.tmp_objects[caption_index].updateWidget(acc_table, caption_index, dev_id);
                this.check_realcheckbox_row(dev_id, otherIndex);
            }
        }
    },

    /**
    * activates the buttons, when a checkbox is checked
    */
    minor_realcheckbox_changed: function(caption_index, table_name, id) {
        var otherIndex = this.get_realcheckbox_indices();

        // mark flag that there were some changes done
        ac_anyChanges = true;
        // click on checkbox should work the same as if notification comes
        // so write value to storage, but don't have to render it because it is already clicked.
        acc_table.data_storage[caption_index][id][0] = $(table_name + "_cb_" + id).checked;

        // uncheck column
        $("cb_" + caption_index).checked = false;
        this.check_realcheckbox_row(id, otherIndex);
    },

    /**
    * returns an array with the caption indices of realcheckboxes
    **/
    get_realcheckbox_indices: function() {
        var otherIndex = new Array();
        acc_table.options.captions.each(function(element, number){
            if ( (element.widget == 'acc_widget_realcheckbox' || element.widget == 'acc_widget_access_rights') && number != acc_table.options.captions.length -1) {
                otherIndex.push(number);
            }
        });
        return (otherIndex);
    },

    check_realcheckbox_row: function(id, otherIndex) {

        var useradminIndex = acc_table.options.captions.length -1;
        var enabled = false;
        for (var i = 0; i < otherIndex.length; i++) {
            if (acc_table.data_storage[otherIndex[i]][id][0]) {
                enabled = true;
                break;
            }
        }
        // set to enable/disable
        acc_table.data_storage[useradminIndex][id][1] = enabled;

        // if disabled uncheck it
        if (!enabled) {
            acc_table.data_storage[useradminIndex][id][0] = false;
        }
        // redraw widget
        acc_table.tmp_objects[useradminIndex].updateWidget(acc_table, useradminIndex, id);
    },

    /**
    * creates an array, of html button elements, with the same style class
    * sets the opacity value of all the elements to the submitted value
    */
    change_button_status: function(opacity, checkboxes_checked) {
        //if we are on details view do nothing
        if (typeof this.options.buttons[0] != "undefined" &&
        typeof this.options.buttons[0].name != "undefined" &&
        this.options.buttons[0].name == "Back") {
            return;
        }

        var button_array = new Array();
        button_array = document.getElementsByClassName("acc_button");

        for (var i = 0; i < button_array.length; i++) {
            if (browser == "ie") {
                if (opacity < 1) {
                    if (last_view == "acc_configuration_vpn_update" && i == 1) {
                        this.check_for_table_rights(button_array[i]);
                    }
                    else {
                        button_array[i].style.filter = "alpha(opacity: " + this.ie_opacity +")";
                    }
                }
                else {
                    button_array[i].style.filter = "alpha(opacity:100)";
                }

                if (checkboxes_checked > 1 || (last_view == "acc_management_user_access_control_update" && i == 0)) {
                    button_array[i].style.filter = "alpha(opacity: " + this.ie_opacity + ")";
                }
                else if ( checkboxes_checked == 1 ) {
                    if (last_view == "acc_configuration_vpn_update" && i == 1 ) {
                        this.check_for_table_rights(button_array[i]);
                    }
                    if ( i == 0 && typeof acc_table.options.no_details != "undefined" && acc_table.options.no_details.length >= 0) {
                        var arr_no_details = acc_table.options.no_details;
                        var arr_checked_ids = this.get_checked_ids();
                        if (arr_no_details.length == 0 || arr_no_details.indexOf(arr_checked_ids[0]) == -1) {
                            button_array[i].style.filter = "alpha(opacity: " + this.ie_opacity +")";
                        }
                    }
                }
                else if ( checkboxes_checked < 1 && last_view == "acc_configuration_vpn_update" && i == 1 ) {
                    this.check_for_table_rights(button_array[i]);
                }
            }
            else {
                if (last_view == "acc_vpn_configuration_update" && i == 1) {
                    this.check_for_table_rights(button_array[i]);
                }
                else {
                    button_array[i].style.opacity = opacity;
                }

                /* details button should be disabled if:
                    * - we have more than one device selected
                    * - we are on ACL view
                    *
                    * webadmin button should be disabled on all pages if:
                    * - we have more than one device selected
                */

                if (checkboxes_checked > 1 || (last_view.match(/_access_control_update$/) && i == 0)) {
                    button_array[i].style.opacity = this.ff_opacity;
                }
                else if (checkboxes_checked == 1) {
                    if (last_view == "acc_configuration_vpn_update" && i == 1) {
                        this.check_for_table_rights(button_array[i]);
                    }
                    if ( i == 0 && typeof acc_table.options.no_details != "undefined" && acc_table.options.no_details.length >= 0) {
                        var arr_no_details = acc_table.options.no_details;
                        var arr_checked_ids = acc_table.get_checked_ids();
                        if ( arr_no_details.length == 0 || arr_no_details.indexOf(arr_checked_ids[0]) == -1) {
                            button_array[i].style.opacity = acc_table.ff_opacity;
                        }
                    }
                }
                else if ( checkboxes_checked < 1 && last_view == "acc_configuration_vpn_update" && i == 1 ) {
                    this.check_for_table_rights(button_array[i]);
                }
            }

            //check if odr export buttons are available
            if ($('odr_button_export_csv') != undefined
            && $('odr_button_export_pdf') != undefined) {
                var tmp_opacity = this.ff_opacity;
                var exports = ['csv','pdf']
                if (checkboxes_checked == 1) {
                    tmp_opacity = 1;
                }
                exports.each(function(format){
                    Element.setOpacity($('odr_button_export_' + format),
                    tmp_opacity);
                });
            }
        }
    },

    /**
    * checks if the button opacity has been changed or not
    * returns true or false
    */
    check_button_active_status: function(object) {
        if (browser == "ie") {
            if (object.style.filter == "alpha(opacity:100)") {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            if (object.style.opacity < 0.9) {
                return false;
            }
            else {
                return true;
            }
        }
    },

    /**
    * creates the orange table header line
    */
    create_orange_bar:function (bar_text) {
        var table_element1 = document.createElement("table");
        table_element1.className = "resources_headline";
        table_element1.setAttribute("cellpadding", "0");
        table_element1.setAttribute("cellspacing", "0");

        var tbody_element1 = document.createElement("tbody");

        var tr_element1 = document.createElement("tr");

        var td_space = document.createElement("td");
        td_space.setAttribute("width", "8");

        var td_element1 = document.createElement("td");
        td_element1.className = "resources_headline_td";

        var text_element1 = document.createTextNode(bar_text);

        var td_element2 = document.createElement("td");
        td_element2.setAttribute("align", "right");

        //appending the elements:
        tr_element1.appendChild(td_space);
        td_element1.appendChild(text_element1);
        tr_element1.appendChild(td_element1);
        tr_element1.appendChild(td_element2);
        tbody_element1.appendChild(tr_element1);
        table_element1.appendChild(tbody_element1);

        return table_element1;
    },

    create_light_gray_background: function(table_class) {
        var html_string = '<table class="' +table_class +'" cellspacing="0" cellpadding="0">' +
            '<tbody>' +
                '<tr>' +
                    '<td class="resources_td_top_left"/>' +
                    '<td class="resources_td_top_center"/>' +
                    '<td class="resources_td_top_right"/>' +
                '</tr>' +
                '<tr>' +
                    '<td class="resources_td_mid_left"/>' +
                    '<td class="resources_td_mid_mid"></td>' +
                    '<td class="resources_td_mid_right"/>' +
                '</tr>' +
                '<tr>' +
                    '<td class="resources_td_down_left"/>' +
                    '<td class="resources_td_down_mid"/>' +
                    '<td class="resources_td_down_right"/>' +
                '</tr>' +
            '</tbody>' +
        '</table>';

        return html_string;
    },

    /**
    * creates an html tooltip object
    */
    create_tooltip_element:function(className, id, first_text ) {
        if ($(id) == undefined) {
            tooltip_element = document.createElement("div");
            tooltip_element.className = className;
            tooltip_element.setAttribute("id", id);
            tooltip_element.innerHTML = '<div class="tooltip_inside">' + iFrameWorkaround + first_text + '</div>';
        }
        else {
            tooltip_element = $(id);
        }
        return tooltip_element;
    },

    /**
    * help function to test the deleting of the devices
    */
    input_deletion_id: function(object) {
        var table_ref = this;

        // checking if the button is active
        if (this.check_button_active_status(object)) {
            id = prompt("Please insert an id which should be deleted: ", "");
            try {
                id = parseInt(id);
                table_ref.delete_tr(id);
            }
            catch(e) {}
        }
    },

    /**
    * help function to test the adding of the devices
    */
    input_add_id: function(object) {
        var table_ref = this;

        // checking if the button is active
        if (this.check_button_active_status(object)) {
            id = prompt("Please insert an id which should be added: ", "");

            var dev_info = table_ref.create_dev_info_structure(id);
            var main_data = table_ref.create_main_data_structure(id);

            try {
                id = parseInt(id);
                table_ref.insert_tr(main_data, dev_info, id);
            }
            catch(e) {}
        }
    },

    /**
    * creates for testing purposes the data structure of one device
    * which can be got via an dev_info rpc call and returns it
    */
    create_dev_info_structure: function(id) {
        var dev_info = {
            "error" : null,
            "id": id,
            "result" : {
                "path" : ["device.info"],
                "objs" : { }
            }
        };

        var inner_dev_info = {
            "pending" : [ ],
            "data":{
                "status":{
                    "connection":"OFFLINE",
                    "device":"PINGABLE",
                    "registration":"CONFIRMED"
                },
                "desc":"",
                "name":"foo",
                "address":{
                    "ipv4_public":"1.1.1.1",
                    "ipv4_agent":"1.1.1.1"
                }
            }
        };
        dev_info.result.objs[id]= inner_dev_info;
        return dev_info;
    },

    /**
    * creates for testing purposes the  main data structure of one device
    * which can be got via an rpc call and returns it
    */
    create_main_data_structure: function(id) {
        var main_data = {
            "error":null,
            "id":11,
            "result":{
                "path":[ "monitoring.dashboard"],
                "objs":{}
            }
        };

        var inner_main_data = {
            "pending":[],
            "data": {
                "status": {
                    "network":0,
                    "threat":0,
                    "version":0,
                    "license":0,
                    "resource":0,
                    "service":0,
                    "availability":0,
                    "level":0,
                    "hardware":0
                },
                "data":{}
            }
        };
        main_data.result.objs[id]= inner_main_data;
        return main_data;
    },

    /**
    * function to highlight one table line
    */
    highlight_table_line: function(event,tr, instance) {
        if (typeof instance == "undefined") {
            instance = this;
        }

        if ( tr.firstChild.className.indexOf("1") != -1 ) {
            var new_style = "resources_td_highlight1";
        }
        else {
            var new_style = "resources_td_highlight2";
        }
        for (var i = 0; i < instance.options.captions.length; i++) {
            tr.childNodes[i].className = new_style;
        }
    },

    /**
    * function to remove the highlight of the table
    */
    remove_line_highlight: function(event, tr, instance) {

        if (typeof instance == "undefined") {
            instance = this;
        }

        var cb_checked = false;
        var id = tr.id.split("_")[1];

        var tr_checkbox = $("checkbox_cb_" + id);
        if ( tr_checkbox != undefined && tr_checkbox.checked ) {
            cb_checked = true;
        }

        if (tr.firstChild.className.indexOf("1") != -1) {
            if (cb_checked) {
                var new_style = "resources_td_clicked1";
            }
            else {
                var new_style = instance.options.table_styles.td_style1;
            }
        }
        else {
            if (cb_checked) {
                var new_style = "resources_td_clicked2";
            }
            else {
                var new_style = instance.options.table_styles.td_style2;
            }
        }
        for (var i = 0; i < instance.options.captions.length; i++) {
            tr.childNodes[i].className = new_style;
        }
    },

    /**
    * function to mark one table line as clicked or not clicked
    */
    mark_clicked_line: function(tr, active) {
        //get the background color of the actual line
        if (active) {
            if ( tr.firstChild.className.indexOf("1") != -1 ) {
                var new_style = "resources_td_clicked1";
            }
            else {
                var new_style = "resources_td_clicked2";
            }
        }
        else {
            if ( tr.firstChild.className.indexOf("1") != -1 ) {
                var new_style = this.options.table_styles.td_style1;
            }
            else {
                var new_style = this.options.table_styles.td_style2;
            }
        }

        for (var i = 0; i < this.options.captions.length; i++) {
            tr.childNodes[i].className = new_style;
        }
    },

    /** function to mark all lines as clicked or not clicked
    *
    */
    mark_all_lines: function(active) {

        if (active) {
            var arr_td1 = document.getElementsByClassName(this.options.table_styles.td_style1);
            var arr_td2 = document.getElementsByClassName(this.options.table_styles.td_style2);

            for (var i = 0; i < arr_td1.length; i++) {
                arr_td1[i].className = "resources_td_clicked1";
            }

            for (var i = 0; i < arr_td2.length; i++) {
                arr_td2[i].className = "resources_td_clicked2";
            }
        }
        else {
            var arr_td1 = document.getElementsByClassName("resources_td_clicked1");
            var arr_td2 = document.getElementsByClassName("resources_td_clicked2");

            for (var i = 0; i < arr_td1.length; i++) {
                arr_td1[i].className = this.options.table_styles.td_style1;
            }
            for (var i = 0; i < arr_td2.length; i++) {
                arr_td2[i].className = this.options.table_styles.td_style2;
            }
        }
    },

    /**
    * hides all elements from the table to enable displaying of the details view
    */
    toggle_whole_table: function(button_object) {
        var display_child = $("display").firstChild;

        if (typeof button_object == "undefined") {
            display_child.toggle();
        }
        else {
            if (this.check_button_active_status(button_object)) {
                display_child.toggle();
            }
        }
    },


    /**
    * returns array with id of devices which are selected
    */
    get_checked_ids: function() {
        var checkbox_array = new Array();
        checkbox_array = document.getElementsByClassName("resources_checkbox_style");

        var selected_array = new Array();

        for (var i = 0; i < checkbox_array.length; i++) {
            if (checkbox_array[i].checked) {
                var tmp_id = checkbox_array[i].id;
                tmp_id = tmp_id.substring( 12, tmp_id.length);
                selected_array.push(tmp_id);
            }
        }
        return selected_array;
    },

    /**
    * returns number of selected devices
    */
    get_number_of_selected_devices: function() {
        return this.get_checked_ids().length;
    },

    /**
    * makes rpc call to reboot a device
    */
    reboot_device: function(object) {
        if (this.check_button_active_status(object)) {
            var id_array = new Array();
            id_array = this.get_checked_ids();
            //make an rpc call that reboots the gateway
            var mes = _LOC("Do you really want to reboot the selected device(s)?");
            var clickfunc = function() {
                call_fid('reboot_device', { 'ids' : id_array });
            }
            showConfirmPopup(mes, clickfunc);
        }
    },

    /**
    * starts rpc call to prefetch updates
    */
    up2date: function(object) {
        if (this.check_button_active_status(object)) {
            var id_array = new Array();
            id_array = this.get_checked_ids();

            //make an rpc call that reboots the gateway
            var mes = _LOC("Do you really want to prefetch Up2Date(s) on the selected device(s)?");
            var clickfunc = function() {
                call_fid('device_update', {'ids' : arr_checked, 'method' : 'prefetch_update'});
            }
            showConfirmPopup(mes, clickfunc);
        }
    },

    /**
    * makes rpc call to shutdown a device
    */
    shutdown_device: function(object) {
        if (this.check_button_active_status(object)) {
            var id_array = new Array();
            id_array = this.get_checked_ids();
            //make an rpc call that reboots the gateway
            var mes = _LOC("Do you really want to shutdown the selected device(s)?");
            var clickfunc = function() {
                call_fid('shutdown_device', { 'ids' : id_array });
            }
            showConfirmPopup(mes, clickfunc);
        }
    },

    /**
    * sets background color of the dashboard tabs content
    */
    set_dashboard_tab_color: function() {
        var dashboard_tab = $('TABSET_dashboard_tabs_CONTENT');
        if (dashboard_tab != null) {
            dashboard_tab.style.backgroundColor = "rgb(255,255,255)";
            dashboard_tab.style.overflow = "visible";
        }
    },

    /**
    * removes the worldmap filter if it exists
    */
    remove_worldmap_filter: function() {
        var worldmap_filter = $('filter_select');
        if (worldmap_filter != null) {
            worldmap_filter.parentNode.removeChild(worldmap_filter);
        }
        var worldmap_input = $('worldmap_devicename_input');
        if (worldmap_input) {
            Element.remove(worldmap_input);
        }
        var dashboard_tab = $('TABSET_dashboard_tabs_CONTENT');
        if (dashboard_tab != undefined) {
            dashboard_tab.removeAttribute("tabindex");
        }
    },


    /**
    * triggers selected action of a dropdown
    */
    button_select_changed: function() {
        var select_object = $("dropdown_field_buttons");
        var selAction = $F(select_object);

        _debug("selAction: " + selAction);

        // which ids are checked?
        var arr_checked = new Array();
        arr_checked = this.get_checked_ids();

        if (arr_checked.length > 0) {
            switch (selAction) {
                case "reboot_device":
                    var mes = _LOC("Do you really want to reboot the selected gateway(s)?");
                    var clickfunc = function() {
                        call_fid('reboot_device', { 'ids' : arr_checked });
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "shutdown_device" :
                    var mes = _LOC("Do you really want to shutdown the selected gateway(s)?");
                    var clickfunc = function() {
                        call_fid('shutdown_device', { 'ids' : arr_checked });
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "prefetch_update" :
                    var mes = _LOC("Do you really want to prefetch Up2Date(s) on the selected gateway(s)?");
                    var clickfunc = function() {
                        call_fid('device_update', {'ids' : arr_checked, 'method' : 'prefetch_update'});
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "install_firmware" :
                    var mes = _LOC("Do you really want to install new firmware on the selected gateway(s)?");
                    var clickfunc = function() {
                        call_fid('device_update', {'ids' : arr_checked, 'method' : 'install_firmware'});
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "install_pattern" :
                    var mes = _LOC("Do you really want to install new patterns on the selected gateway(s)?");
                    var clickfunc = function() {
                        call_fid('device_update', {'ids' : arr_checked, 'method' : 'install_pattern'});
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "execute_script" :
                    var mes = _LOC("Do you really want to execute the selected script(s)?");
                    var clickfunc = function() {
                        call_fid('get_popup_script_data', {'ids' : arr_checked});
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "delete" :
                    //configuration vpn delete
                    var mes = _LOC("Do you really want to delete the selected vpn object(s)?");
                    var clickfunc = function() {
                        call_fid('vpn_remove', {'ids': arr_checked, 'force': true});
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "delete_report" :
                    //odr report delete
                    var mes = _LOC("Do you really want to delete the selected report(s)?");
                    var clickfunc = function() {
                        call_fid("odr_remove", {'search_ids' : arr_checked });
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "save_report" :
                    //odr report save
                    var mes = _LOC("Do you really want to save the selected report(s)?");
                    var clickfunc = function() {
                        var objs = [];
                        arr_checked.each(function(report_id){
                            var tmp_desc = $('description_odr_description_' + report_id);
                            if (tmp_desc != undefined && tmp_desc.nodeName == 'INPUT') {
                                objs.push({
                                    "id"   : report_id,
                                    "desc" : $F(tmp_desc)
                                });
                            }
                        });
                        if (objs.length > 0) {
                            call_fid("odr_save", {'objs' : objs});
                        }
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "modify" :
                    //vpn modify
                    if (inner_key_exists(acc_table, ['options', 'invalid_guids']) && acc_table.options.invalid_guids[arr_checked[0]] != undefined) {
                        alert(_LOC("Modification of the selected vpn configuration is not possible, maybe one of the UTMs isn't fully supported or isn't connected to SUM any more."));
                    }
                    else {
                        acc_table.open_wizard(arr_checked);
                    }
                break;

                case "enable" :
                    //configuration vpn enable
                    if (inner_key_exists(acc_table, ['options', ['invalid_guids']]) && acc_table.options.invalid_guids[arr_checked[0]]!= undefined) {
                        alert(_LOC("Activation of the selected vpn configuration is not possible, maybe one UTM isn't fully supported or not connected to SUM any more."));
                    }
                    else {
                        var mes = _LOC("Do you really want to enable the selected vpn configuration(s)?");
                        var clickfunc = function() {
                            call_fid('vpn_manage', { 'type' : 'enable', 'objs' : arr_checked});
                        }
                        showConfirmPopup(mes, clickfunc);
                    }
                break;

                case "disable" :
                    //configuration vpn disable
                    if (inner_key_exists(acc_table, ['options', ['invalid_guids']]) && acc_table.options.invalid_guids[arr_checked[0]]!= undefined) {
                        alert(_LOC("Deactivation of the selected vpn configuration is not possible, maybe one UTM isn't fully supported or not connected to SUM any more."));
                    }
                    else {
                        var mes = _LOC("Do you really want to disable the selected vpn object(s)?");
                        var clickfunc = function() {
                            call_fid('vpn_manage', { 'type' : 'disable', 'objs' : arr_checked});
                        }
                        showConfirmPopup(mes, clickfunc);
                    }
                break;

                case "create_backup" :
                    var mes = _LOC("Do you really want to create backups for the selected devices?");
                    var clickfunc = function() {
                        call_fid('backup_create', {'objs' : arr_checked});
                    }
                    showConfirmPopup(mes, clickfunc);
                break;

                case "Activate MSP" :
                    change_device_msp_licensing_status(arr_checked, true);
                break;

                case "Deactivate MSP" :
                    change_device_msp_licensing_status(arr_checked, false);
                break;

                case "activate_atp" :
                    sum.atp.change_device_atp_status(arr_checked, true);
                break;

                case "deactivate_atp" :
                    sum.atp.change_device_atp_status(arr_checked, false);
                break;

                case "edit_atp" :
                    sum.atp.start_wizard(arr_checked);
                break;

                default :
                //Start Message
                // nothing to do here
                break;
            }

            // reset the dropdown field
            select_object.selectedIndex = 0;
        }
    },

    /** creates the html code of an dropdown box used
    *  to trigger actions like e.g. shutdown or reboot
    */
    create_actions_dropdown_box: function() {

        var select1 = document.createElement("select");
        select1.id = "dropdown_field_buttons";
        select1.className = "acc_dropdown_select_button";

        if (this.options.name.toLowerCase().indexOf("details") != -1) {
            select1.onchange = function() { acc_details.button_select_changed()};
        }
        else {
            select1.onchange = function() { acc_table.button_select_changed()};
        }

        var option0 = document.createElement("option");
        option0.setAttribute("value", "");

        var text0 = document.createTextNode("::With selected::");
        option0.appendChild(text0);
        option0.className = "acc_dropdown_option_button";
        select1.appendChild(option0);

        //check if a details view should be shown, then don't disable the dropdown field
        var details_reg_exp = new RegExp( "details", "i");
        if ( ! details_reg_exp.exec(this.options.name)) {
            select1.setAttribute("disabled", "");
            select1.disabled = true;
        }


        var arr_actions = available_actions();

        //if table specifies the actions take table_actions
        if (typeof this.options.table_actions != "undefined") {
            arr_actions = this.options.table_actions;
        }

        //setting all actions
        for (var i = 0; i < arr_actions.length; i++) {
            var next_option = this.createActionDropdownEntry(arr_actions[i]);
            select1.appendChild(next_option);
        }
        return select1;
    },

    /**
    * calls backend function to open the webadmin in a new tab
    */
    commit_device_sso: function( object ) {
        if (this.check_button_active_status(object)) {
            var id_array = new Array();
            id_array = this.get_checked_ids();
            call_fid('prepare_device_sso', { 'ids' : id_array});
        }
    },

    /**
    * activates checkbox by clicking on a tr
    * highlightes the tr
    */
    activate_checkbox: function(event, object) {
        try {
            var guid = object.id.split("_")[1];

            // try to check the checkbox
            var checkbox = $('checkbox_cb_' + guid);

            if (last_view != "acc_management_user_access_control_update") {
                //toggle the checkbox
                if (checkbox.checked) {
                    checkbox.checked = false;
                    this.mark_clicked_line(object, false);
                    if ( this.get_checked_ids().length == 0) {
                        this.disable_actions_dropdown();
                    }
                    this.change_button_dropdown_entries( this.options.name);
                }
                else {
                    checkbox.checked = true;
                    this.mark_clicked_line(object, true);
                    this.enable_actions_dropdown();
                    this.change_button_dropdown_entries(this.options.name);
                }
            }
            else {
                if (checkbox.checked) {
                    this.mark_clicked_line(object, true);
                    this.enable_actions_dropdown();
                }
                else {
                    this.mark_clicked_line(object, false);
                    if ( this.get_checked_ids().length == 0) {
                        this.disable_actions_dropdown();
                    }
                }
            }

            //activate or disable the buttons
            this.minor_checkbox_changed();
        }
        catch(e) {}
    },


    /**
    * checks / unchecks a checkbox
    */
    check_checkbox: function(checkbox) {
        if (last_view == "acc_management_user_access_control_update") {
            this.minor_checkbox_changed();
        }
        else {
            if (checkbox.checked) {
                checkbox.checked = false;
            }
            else {
                checkbox.checked = true;
            }
        }
    },


    /**
    * checks if a filter of the table disallows displaying of a device
    */
    check_device_filters: function(guid) {
        //data needed for the check
        //submitted_value, guid, mode, j

        //try to deactivate the actions and buttons
        try {
            this.disable_actions_and_buttons();
        }
        catch(e) {}

        var mode = "normal";
        var show_device = true;

        var arr_captions = acc_table.options.captions;

        var submitted_value = "";

        for (var j = 0; j < this.tmp_objects.length; j++) {
            //get the value of the filter
            var filter_object = $('resources_filter_' + arr_captions[j]["identifier"]);

            if ( filter_object != undefined && filter_object.hasChildNodes()) {
                submitted_value = $F(filter_object.firstChild);
                //change the submitted value if the object is an dropdown field and the submitted  value is all
                if (filter_object.firstChild.nodeName.toLowerCase() == "select" && submitted_value == "all") {
                    submitted_value = "";
                }
            }
            var filter_data = acc_table.tmp_objects[j].getFilterData();

            //check if at least one filter disallows showing the device
            //get the filter object
            if (submitted_value != undefined && submitted_value != "") {
                var filter_obj = filter_data["filterObject"];
                show_device = filter_obj.prove_device( submitted_value, guid, mode, j, filter_data);
            }
            if (!show_device) {
                break;
            }
        }
        return show_device;
    },


    /**
    * shows detail view instead of normal table view
    **/
    show_detail_view: function(event,tr_element) {

        try {
            if (last_view != "acc_management_user_access_control_update") {

                var guid = tr_element.id.split("_")[1];
                if (last_view.match(/_reporting_/)) {
                    if ( typeof this.options.no_details != "undefined" && this.options.no_details.length > 0 &&  this.options.no_details.indexOf(guid) != -1) {
                        show_details(guid);
                    }
                }
                else {
                    show_details(guid);
                }
            }
        }
        catch(e) {}
    },

    /**
    * fills the dropdown again with the available actions if actions were removed
    * from the dropdown before
    */
    add_dropdown_actions: function() {
        //get the dropdown field
        var select1 = $('dropdown_field_buttons');

        //get the array with the actions
        var arr_actions = available_actions();

        //check if actions are already displayed in the dropdown field
        if (select1.childNodes.length < arr_actions.length) {
            for (var i = 0; i < arr_actions.length; i++) {
                var next_option = document.createElement("option");
                next_option.className = "acc_dropdown_option_button";
                next_option.setAttribute("value", arr_actions[i]);
                var option_text = document.createTextNode(map_actions(arr_actions[i]));
                next_option.appendChild(option_text);
                select1.appendChild(next_option);
            }
        }
    },

    /**
    * keeps only the first entry of a dropdown and removes all others
    */
    remove_dropdown_actions: function() {
        //get the dropdown field
        var select1 = $('dropdown_field_buttons');
        //remove all entries without the first one
        if (select1 != undefined) {
            while( select1.childNodes.length > 1) {
                select1.removeChild(select1.childNodes[1]);
            }
        }
    },

    /**
    * sets disabled attribute for a dropdown
    */
    disable_actions_dropdown: function() {
        //get the dropdown field
        var select1 = $('dropdown_field_buttons');
        if (select1 != undefined) {
            select1.disabled = true;
        }
    },

    /**
    * removes disabled attribute on a dropdown
    */
    enable_actions_dropdown: function() {
        //get the dropdown field
        var select1 = $('dropdown_field_buttons');
        if (select1 != undefined) {
            select1.disabled = false;
        }
    },


    /**
    * disables checkboxes and buttons of the table if necessary
    */
    disable_actions_and_buttons: function() {
        var details_reg_exp = new RegExp( "(details)|(vpn)", "i");
        if (! details_reg_exp.exec(this.options.name)) {
            this.change_button_status( 0.5, 0);
            this.disable_actions_dropdown();
            this.uncheck_caption_checkbox();
        }
    },

    /**
    * unchecks the master checkbox of the table
    */
    uncheck_caption_checkbox: function() {
        try {
            var caption_checkbox = $('captions_checkbox').firstChild;
            if ( caption_checkbox.checked ) {
                caption_checkbox.checked = null;
            }
        }
        catch(e) {}
    },

    /**
    * returns html string of a button
    */
    createButtonString: function(id, img_src, button_text) {
        var button_string = '<table class="acc_button" id="'+id+'">' +
            '<tbody>' +
                '<tr>' +
                    '<td class="resources_td_image">' +
                        '<div align="center">' +
                            '<table class="resources_button_inner_table">' +
                                '<tbody>' +
                                    '<tr>' +
                                        '<td>' +
                                            '<img class="resources_button_image" src="'+img_src+'"/>' +
                                        '</td>' +
                                        '<td style="width: 2px;"/>' +
                                        '<td class="resources_acc_button_td">' +
                                            button_text +
                                        '</td>' +
                                    '</tr>' +
                                '</tbody>' +
                            '</table>' +
                        '</div>' +
                    '</td>' +
                '</tr>' +
            '</tbody>' +
        '</table>';
        return button_string;
    },


    /**
    * changes the entries of the actions dropdown for vpn or
    * normal table usage
    **/
    change_button_dropdown_entries: function( table_name ) {

        if ( table_name.match(/vpn/)) {
            var dropdown_action = $('acc_dropdown_button_modify');
            var dropdown_select = $('dropdown_field_buttons');
            var checked_ids = this.get_checked_ids().length;

            if ( checked_ids == 1) {
                if (dropdown_action == undefined) {
                    var new_entry = this.createActionDropdownEntry("modify");
                    var enable_entry = $('acc_dropdown_button_enable');
                    dropdown_select.insertBefore( new_entry, enable_entry);
                }
            }
            else if (checked_ids > 1) {
                if (dropdown_action != undefined) {
                    dropdown_select.removeChild(dropdown_action);
                }
            }
        }
    },


    /**
    * creates a option element which triggers a special action
    **/
    createActionDropdownEntry : function(action_name) {
        var next_option = document.createElement("option");
        next_option.className = "acc_dropdown_option_button";
        next_option.id = "acc_dropdown_button_" + action_name;
        next_option.setAttribute("value", action_name);
        var option_text = document.createTextNode(map_actions(action_name));
        next_option.appendChild(option_text);
        return next_option;
    },

    /**
    * tries to open the vpn wizard for
    * creating or modifying a vpn
    * checks if user has rights
    **/
    open_wizard: function(arr_ids) {
        if (arr_ids != undefined && arr_ids.length == 1) {
            if (inner_key_exists(acc_table, ['options', 'invalid_guids']) && acc_table.options.invalid_guids[arr_ids[0]] != undefined) {
                alert(_LOC("Modification of the selected vpn configuration is not possible, maybe one of the UTMs isn't fully supported or isn't connected to SUM any more."));
            }
            else {
                core.wizard.acc_wizard_vpn(arr_ids[0]);
            }
        }
        else if ( arr_ids != undefined && arr_ids.length == 0) {
            //creation of a new vpn
            //does the user have rights?
            if (acc_table.options.rights == 0) {
                alert("Cannot create a vpn configuration, there do not exist at least two gateways which are fully supported by SUM and where you have rights for.");
                return;
            }
            core.wizard['acc_wizard_vpn']();
        }
    },

    /**
     * changes the label of the vpn wizard button from create to modify
    */
    change_vpn_create_button: function() {
        if (last_view == "acc_configuration_vpn_update" ) {
            button_arr = document.getElementsByClassName("resources_acc_button_td");

            if ( this.get_checked_ids().length == 0 ) {
                button_arr[1].innerHTML = "Create";
            }
            else if ( this.get_checked_ids().length == 1 ) {
                button_arr[1].innerHTML = "Modify";
            }
        }
    },

    /**
     * changes button opacity if user has no rights
    **/
    check_for_table_rights: function(table_element) {
        if (this.options.rights == 0) {
            if ( typeof table_element != "undefined") {
                var opacity = this.ff_opacity;
                this.set_button_opacity( table_element, opacity);
            }
        }
        else {
            this.set_button_opacity(table_element, 1);
        }
    },

    /**
     * device based reporting sorts the data for the image slideshow
    **/
    sort_slideshow_data: function() {
        if (typeof this.options.full_slideshow_data != "undefined" && typeof this.options.full_slideshow_map != "undefined" && this.options.full_slideshow_map != undefined ) {
            var new_sd    = new Object();
            var arr_times = Object.keys(this.options.full_slideshow_data);
            arr_times     = arr_times.without("extend");
            for ( var i = 0; i < arr_times.length; i++) {
                this.options.arr_ids.each(function(element){
                    if (typeof new_sd[arr_times[i]] == "undefined") {
                        new_sd[arr_times[i]] = new Array;
                    }
                    if ( typeof this.options.full_slideshow_map[element] != "undefined" && typeof this.options.full_slideshow_map[element][arr_times[i]] != "undefined" ) {
                        new_sd[arr_times[i]].push(this.options.full_slideshow_map[element][arr_times[i]]);
                    }
                }.bind(this));
            }
            this.options.full_slideshow_data = new_sd;
        }
    },

    /**
    * checks if string or number is submitted, if string is submitted
    * tries to convert string into number
    **/
    checkforNumber: function(str1) {
        var ret_val = str1;

        //check if really string
        if (typeof str1 != "string") {
            return ret_val;
        }
        else {
            if ( str1.match(/[a-zA-Z]/) || str1.match(/\s/)) {
                return ret_val;
            }
            else {
                //try to convert string into number
                var number  = parseInt(str1);
                var check   = number.toString();

                if (number != NaN && check.length == str1.length) {
                    ret_val = number;
                }
                return ret_val;
            }
        }
    },

    odr_export: function(event, img) {
        if (this.get_checked_ids().length == 1) {
            var search_id = this.get_checked_ids()[0];
            var type = img.id.replace(/odr_button_export_/,'');
            if (search_id && type) {
                odr_start_export(search_id, type, '', 'desc');
            }
        }
    },

    display_number_change: function(dropdown){
        var sel_val = $F(dropdown);
        var max_num = 0;

        //case default is selected
        if (dropdown.selectedIndex == 0) {
            max_num = this.options.default_max_num;
        }
        //case all is selected
        else if (dropdown.selectedIndex == 1) {
            max_num = this.options.arr_ids.length + 1;
        }
        else {
            if (typeof sel_val == 'string') {
                max_num = parseInt(sel_val);
            }
            else {
                max_num = sel_val;
            }
        }

        this.options.max_tr_elements = max_num;
        var high = max_num;

        if ( max_num + 1 > this.options.arr_ids.length) {
            high = this.options.arr_ids.length;
        }

        this.tr_displayed.low  = 1;
        this.tr_displayed.high = high;

        this.update_browsebutton_text(1,
        high, this.options.arr_ids.length);
        this.redraw_table();

    },

    create_display_dropdown: function() {

        //save default max_tr_elements
        if (typeof this.options.default_max_num == "undefined") {
            this.options.default_max_num = this.options.max_tr_elements;
        }

        var span3a = document.createElement("span");
        span3a.className = "acc_table_header_span3a";
        var display = [
            '::Display::',
            'All',
            '10',
            '25',
            '50',
            '100',
            '250',
            '500'
        ];

        var select3a = document.createElement("select");
        select3a.className = "acc_dropdown_select_display";
        select3a.setAttribute("size", "1");
        select3a.setAttribute("id", "display_option");
        Event.observe(select3a, 'change',
        this.display_number_change.bind(this, select3a));
        display.each(function(elem) {
            var tmp_display = document.createElement("option");
            tmp_display.className = "acc_dropdown_option_button";
            tmp_display.value = elem;
            var tmp_text = document.createTextNode(elem);
            tmp_display.appendChild(tmp_text);
            select3a.appendChild(tmp_display);
        });
        span3a.appendChild(select3a);
        return span3a;
    },

    redraw_table: function(){
        this.clear_all_trs();
        var high = this.tr_displayed.high;

        for (var i = 0; i < high; i++) {
            // find out the id of the table element
            var index_num = this.tr_displayed.low -1 + i;
            var id = this.options.arr_ids[index_num];

            if ( i % 2 == 0) {
                var td_style = this.options.table_styles.td_style1;
            }
            else {
                var td_style = this.options.table_styles.td_style2;
            }
            var tr_element = this.data_storage_to_tr(id, td_style);

            var master_td_element = $("acc_table_" + this.options.name + "_items");
            master_td_element.firstChild.appendChild(tr_element);
        }
    }
};
