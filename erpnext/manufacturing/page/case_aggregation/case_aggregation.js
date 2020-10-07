// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

        frappe.pages['case_aggregation'].on_page_load = function (wrapper) {
            page = frappe.ui.make_app_page({
                parent: wrapper,
                title: __('Case Aggregation'),
                single_column: true
            });

            //new erpnext.ProductionAnalytics(wrapper);

            frappe.breadcrumbs.add("Stock", "Stock Entry");

            page.main.html(frappe.render_template("case_aggregation", {}));
        }

		var boxesPerCase = 0;
		var boxItem = "";

        var stockEntryName = window.location.hash.substr(window.location.hash.lastIndexOf('/') + 1);
        var selectedCaseSerial = "";
        var obj = {
            CaseSerials: [],
            SelectedChildSerials: [],
            UnscannedChildSerials: []
        };
		var imported = document.createElement('script');
		imported.src = 'https://d3js.org/d3.v5.min.js';
		document.head.appendChild(imported);

        $(document).ready(function () {
            frappe.call({
                "method": "erpnext.manufacturing.page.case_aggregation.case_aggregation.get_case_serials",
                args: {
                    stockEntryName: stockEntryName
                },
                callback: function (r) {
                    frappe.db.get_value('Stock Entry', { name: stockEntryName }, 'work_order', (r) => {
                        frappe.db.get_value('Work Order', { name: r.work_order }, 'boxes_per_case', (p) => {
							boxesPerCase = p.boxes_per_case;
							ProcessCaseStatus();
						});
						
                        frappe.db.get_value('Work Order', { name: r.work_order }, 'box_item', (p) => {
							boxItem = p.box_item;
						});

                        $('#ProductionOrderLink').text(r.work_order).attr('href', 'https://erp.lohxa.com/desk#Form/Work%20Order/' + r.work_order);
                    });

                    $("#CaseTable tbody").empty();
                    for (var i = 0; i < r.message.length; i++) {
                        $("#CaseTable tbody").append(MakeCaseRowHtml(r.message[i]));
                    }

                   // frappe.db.get_value('Stock Entry', { name: stockEntryName }, 'posting_date', (r) => {
                   //     $('#ProductionOrderLink').text(r.posting_date);
                   // });
                    $('#StockEntryLink').text(stockEntryName).attr('href', 'https://erp.lohxa.com/desk#Form/Stock%20Entry/' + stockEntryName);

                    $('.casesTotal').text($("#CaseTable tbody tr").length);

                    $("#CaseTable tbody tr").click(function () {
                        selectedCaseSerial = $(this).attr('data-case-serial');
                        $("#CaseTable tbody tr").removeClass("selected");

                        $(this).addClass("selected");
                        $("#SelectedCase").text(selectedCaseSerial);

                        frappe.call({
                            "method": "erpnext.manufacturing.page.case_aggregation.case_aggregation.get_case_child_serials",
                            args: {
                                serialNo: selectedCaseSerial
                            },
                            callback: function (r) {
                                var data = r.message;
                                SelectedChildSerials = [];
                                $("#ChildBoxTable tbody").empty();
                                if (data) {
                                    for (var c = 0; c < data.length; c++) {
                                        $("#ChildBoxTable tbody").append('<tr><td><span class="text-semibold">' + data[c].serial_no + '</span></td></tr>');
                                    }
                                }
                                var boxesScanned = $("#ChildBoxTable tbody tr").length;

                                RefreshUnscanned();
								SetDonutPercentage(boxesScanned / boxesPerCase);

                                $('#SelectedCaseScanned').text(boxesScanned);
                                $('#BigBoxesScanned').text(boxesScanned);

                                $('#SelectedCaseLeft').text(boxesPerCase - boxesScanned);
                                $('#BigBoxesLeft').text(boxesPerCase - boxesScanned);

                                $('#BigBoxesScanned').closest('div.panel').removeClass('bg-danger-400 bg-success-300 bg-slate-300').addClass((boxesScanned == boxesPerCase ? 'bg-success-300' : 'bg-danger-400'));
                                $('#BigBoxesLeft').closest('div.panel').removeClass('bg-danger-400 bg-success-300 bg-slate-300').addClass((boxesScanned == boxesPerCase ? 'bg-success-300' : 'bg-danger-400'));

								$('.caseRow.selected .caseBoxesScanned').text(boxesScanned);
								ProcessCaseStatus();
                            }
                        });
                    });
					
                    //$("#CaseTable tbody tr").first().click();
					$('.primary-action').append('<i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Finalize</span>').addClass('disabled').removeClass('hide').click(function(){
						 frappe.call({
						"method": "erpnext.manufacturing.page.case_aggregation.case_aggregation.set_case_aggregation_completed",
						args: {
							stockEntryName: stockEntryName
						},
						callback: function (r) {
								window.location = 'https://erp.lohxa.com/desk#List/Stock%20Entry/List';
							}});
					});

					$('.btn-secondary').append('<i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Reprint Serial No</span>').removeClass('hide').show().click(function(){
						var dialog = new frappe.ui.Dialog({
							fields: [
								{fieldtype:'Link', options:'Serial No',
									reqd:1, label:'Serial No', filters: {'item_code': boxItem, 'purchase_document_no': stockEntryName}},
								{fieldtype:'Link', options:'Item',
									reqd:1, label:'Item', read_only:1, default:boxItem}
							]
						});
					
                        dialog.set_primary_action(__('Print'), function () {
                            if (window.confirm('This will override any running serialization print jobs. Do you want to continue?')) {
                                var data = dialog.get_values();
                                if (!data) return;

                                frappe.call({
                                    method: "erpnext.manufacturing.page.case_aggregation.case_aggregation.make_reprint_request",
                                    args: data,
                                    callback: function (r) {
                                        dialog.hide();
                                        frappe.msgprint({
                                            title: __('Reprint Request Submitted'),
                                            message: __('The Serial Reprint Request was submitted'),
                                            indicator: 'green'
                                        });
                                    }
                                });
                            }
                        });
						
						dialog.show();
                    });
                    $('button.reprint').click(function () {
                        if (window.confirm('This will override any running serialization print jobs. Do you want to continue?')) {
                            RePrintUnscanned();
                        }
                    });
                    RefreshUnscanned();
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
		function ProcessCaseStatus()
		{
			$(".caseRow").each(function (){
                var scanned = parseInt($(this).find('.caseBoxesScanned').text());
				if(boxesPerCase - scanned == 0)
				{
					$(this).find('.statusLabel').removeClass('bg-green bg-orange').addClass('bg-green').text('Complete');
				}
				else
				{
                    $(this).find('.statusLabel').removeClass('bg-green bg-orange').addClass('bg-orange').text('Missing Boxes');
				}
			});

			if($(".caseRow .statusLabel.bg-orange").length == 0)
			{
				$('.primary-action').removeClass('disabled');
			}
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
            var isComplete = parseInt(arrayData[1]) >= boxesPerCase;
            return '<tr class="caseRow" data-case-serial="' + arrayData[0] + '"><td><span class="text-semibold">' + arrayData[0] + '</span></td><td><span class="text-muted caseBoxesScanned">' + arrayData[1] + '</span></td><td><span class="label statusLabel"></span></td></tr>';
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