// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

        frappe.pages['delivery_scanning'].on_page_load = function (wrapper) {
            page = frappe.ui.make_app_page({
                parent: wrapper,
                title: __('Delivery Scanning'),
                single_column: true
            });

            //new erpnext.ProductionAnalytics(wrapper);

            frappe.breadcrumbs.add("Delivery Note", "Delivery Note");

            page.main.html(frappe.render_template("delivery_scanning", {}));
        }

		var boxesPerCase = 0;
		var boxItem = "";

        var deliveryNoteName = window.location.hash.substr(window.location.hash.lastIndexOf('/') + 1);
        var selectedCaseSerial = "";
        var selectedPalletSerial = "";
        var obj = {
            CaseSerials: [],
            SelectedChildSerials: [],
            UnscannedChildSerials: []
        };
		var imported = document.createElement('script');
		imported.src = 'https://d3js.org/d3.v5.min.js';
		document.head.appendChild(imported);

        $(document).ready(function () {
            let deliveryNote = await frappe.getDoc('Delivery Note', deliveryNoteName);

            $('#DeliveryNoteLink').text(deliveryNote.name).attr('href', 'https://erp.lohxa.com/desk#Form/Delivery Note/' + deliveryNote.name);
            $('#SalesOrderLink').text(deliveryNote.sales_order).attr('href', 'https://erp.lohxa.com/desk#Form/Delivery Note/' + deliveryNote.sales_order);
            $('#CustomerLink').text(deliveryNote.customer).attr('href', 'https://erp.lohxa.com/desk#Form/Delivery Note/' + deliveryNote.customer);
            
            frappe.db.get_value('Sales Order', { name: deliveryNote.sales_order }, 'total_qty', (p) => {
                $('#QuantityOrdered').text(p.total_qty);
            });         

            frappe.call({
                "method": "erpnext.stock.page.delivery_scanning.delivery_scanning.get_pallet_serials",
                args: {
                    deliveryNoteName: deliveryNoteName
                },
                callback: function (r) {
                    $("#PalletTable tbody").empty();
                    for (var i = 0; i < r.message.length; i++) {
                        $("#PalletTable tbody").append(MakeCaseRowHtml(r.message[i]));
                    }

                    $("#PalletTable tbody tr").click(function () {
                        selectedPalletSerial = $(this).attr('data-case-serial');
                        $("#PalletTable tbody tr").removeClass("selected");

                        $(this).addClass("selected");
                        $("#SelectedPallet").text(selectedPalletSerial);

                        frappe.call({
                            "method": "erpnext.stock.page.delivery_scanning.delivery_scanning.get_pallet_child_serials",
                            args: {
                                serialNo: selectedPalletSerial
                            },
                            callback: function (r) {
                                var data = r.message;
                                SelectedChildSerials = [];
                                $("#ChildCaseTable tbody").empty();
                                if (data) {
                                    for (var c = 0; c < data.length; c++) {
                                        $("#ChildCaseTable tbody").append('<tr><td><span class="text-semibold">' + data[c].serial_no + '</span></td></tr>');
                                    }
                                }
                                var casesScanned = $("#ChildCaseTable tbody tr").length;

        //                        RefreshUnscanned();
								//SetDonutPercentage(boxesScanned / boxesPerCase);

        //                        $('#SelectedCaseScanned').text(boxesScanned);
        //                        $('#BigBoxesScanned').text(boxesScanned);

        //                        $('#SelectedCaseLeft').text(boxesPerCase - boxesScanned);
        //                        $('#BigBoxesLeft').text(boxesPerCase - boxesScanned);

        //                        $('#BigBoxesScanned').closest('div.panel').removeClass('bg-danger-400 bg-success-300 bg-slate-300').addClass((boxesScanned == boxesPerCase ? 'bg-success-300' : 'bg-danger-400'));
        //                        $('#BigBoxesLeft').closest('div.panel').removeClass('bg-danger-400 bg-success-300 bg-slate-300').addClass((boxesScanned == boxesPerCase ? 'bg-success-300' : 'bg-danger-400'));

                                $('.caseRow.selected .caseBoxesScanned').text(casesScanned);
                            }
                        });
                    });
					
					$('.primary-action').append('<i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Finalize</span>').addClass('disabled').removeClass('hide').click(function(){
						 frappe.call({
                             "method": "erpnext.stock.page.delivery_scanning.delivery_scanning.set_pallet_aggregation_completed",
						args: {
                            deliveryNoteName: deliveryNoteName
						},
						callback: function (r) {
                            window.location = 'https://erp.lohxa.com/desk#List/Delivery%20Note/' + deliveryNoteName;
							}});
					});

                    //RefreshUnscanned();
                }
            });

            

        });

        function RefreshUnscanned() {
            frappe.call({
                "method": "erpnext.manufacturing.page.case_aggregation.case_aggregation.get_unscanned_stock_entry_serials",
                args: {
                    stockEntryName: stockEntryName
                },
                callback: function (r) {
                    obj.UnscannedChildSerials = [];
                    $("#UnscannedChildBoxTable tbody").empty();

                    if (r.message) {
                        for (var c = 0; c < r.message.length; c++) {
                            $("#UnscannedChildBoxTable tbody").append('<tr class="serialNoRow"><td><span class="text-semibold">' + r.message[c].name + '</span></td></tr>');
                        }
                    }

                    if ($("#UnscannedChildBoxTable tbody .serialNoRow").length === 0) {
                        $('button.reprint').addClass('disabled');
                    }
                    else {
                        $('button.reprint').removeClass('disabled');
                    }
                }
            });
        }


        function RePrintUnscanned() {
            frappe.call({
                "method": "erpnext.manufacturing.page.case_aggregation.case_aggregation.reprint_unscanned",
                args: {
                    stockEntryName: stockEntryName
                },
                callback: function (r) {
                    frappe.msgprint({
                        title: __('Reprint Request Submitted'),
                        message: __('The Serial Reprint Request was submitted'),
                        indicator: 'green'
                    });
                }
            });
        }


        function SetDonutPercentage(percent) {
			$("#progress_percentage_one").empty();
            var width = 92;
            var height = 92;
            var margin = 4;
            var radius = Math.min(width, height) / 2 - margin;

            var svg = d3.select("#progress_percentage_one")
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .append("g")
                .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

            var data = {
                a: percent, b: 1 - percent
            };

            var colorToUse = percent == 1 ? '#8BC34A' : '#2196f3';

            var color = d3.scaleOrdinal()
                .domain(data)
                .range([colorToUse, "#eeeeee"]);

            var pie = d3.pie()
                .value(function (d) { return d.value; }).sort(null)
            var data_ready = pie(d3.entries(data))

            svg
                .selectAll('whatever')
                .data(data_ready)
                .enter()
                .append('path')
                .attr('d', d3.arc()
                    .innerRadius(46)         // This is the size of the donut hole
                    .outerRadius(radius)
                )
                .attr('fill', function (d) { return (color(d.data.key)) })
                .style("opacity", 0.9);
            var g =  d3.select("#progress_percentage_one svg g");
                g.append("text")
                .attr("text-anchor", "middle")
                .attr('font-size', '22px')
                .attr('fill', colorToUse)
                .attr('y', 8)
                .text(Math.round(percent * 100) + '%');
        }

        function MakeCaseRowHtml(arrayData)
        {
            return '<tr class="caseRow" data-pallet-serial="' + arrayData[0] + '"><td><span class="text-semibold">' + arrayData[0] + '</span></td><td><span class="text-muted caseBoxesScanned">' + arrayData[1] + '</span></td><td><th class="col-md-2">< button class="btn btn-primary btn-sm reprint" ><i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Print</span></button ></th ></td></tr>';
        }

        $.fn.codeScanner = function (options) {
            var settings = $.extend({}, $.fn.codeScanner.defaults, options);

            return this.each(function () {
                var pressed = false;
                var chars = [];
                var $input = $(this);

                $(window).keypress(function (e) {
                    var keycode = (e.which) ? e.which : e.keyCode;
                    if ((keycode >= 65 && keycode <= 90) ||
                        (keycode >= 97 && keycode <= 122) ||
                        (keycode >= 48 && keycode <= 57)
                    ) {
                        chars.push(String.fromCharCode(e.which));
                    }
                    // console.log(e.which + ":" + chars.join("|"));
                    if (pressed == false) {
                        setTimeout(function () {
                            if (chars.length >= settings.minEntryChars) {
                                var barcode = chars.join("");
                                settings.onScan($input, barcode);
                            }
                            chars = [];
                            pressed = false;
                        }, settings.maxEntryTime);
                    }
                    pressed = true;
                });

                $(this).keypress(function (e) {
                    if (e.which === 13) {
                        e.preventDefault();
                    }
                });

                return $(this);
            });
        };

        $.fn.codeScanner.defaults = {
            minEntryChars: 8,
            maxEntryTime: 100,
            onScan: function ($element, barcode) {
                $element.val(barcode);
            }
        };