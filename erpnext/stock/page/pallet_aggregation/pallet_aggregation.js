frappe.pages['pallet_aggregation'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Pallet Aggregation',
		single_column: true
	});

	page.main.html(frappe.render_template("pallet_aggregation", {}));
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

            $('.primary-action').append('<i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Finalize</span>').addClass('disabled').removeClass('hide').click(function () {
                frappe.call({
                    "method": "erpnext.stock.page.delivery_scanning.delivery_scanning.set_pallet_aggregation_completed",
                    args: {
                        deliveryNoteName: deliveryNoteName
                    },
                    callback: function (r) {
                        window.location = 'https://erp.lohxa.com/desk#List/Delivery%20Note/' + deliveryNoteName;
                    }
                });
            });
            //RefreshUnscanned();
        }
    });
});
