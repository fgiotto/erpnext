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
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Delivery Note",
            name: deliveryNoteName,
        },
        callback(r) {
            if (r.message) {
                var deliveryNote = r.message;
                $('#DeliveryNoteLink').text(deliveryNote.name).attr('href', 'https://erp.lohxa.com/desk#Form/Delivery Note/' + deliveryNote.name);
                $('#SalesOrderLink').text(deliveryNote.sales_order).attr('href', 'https://erp.lohxa.com/desk#Form/Sales Order/' + deliveryNote.sales_order);
                $('#CustomerLink').text(deliveryNote.customer).attr('href', 'https://erp.lohxa.com/desk#Form/Customer/' + deliveryNote.customer);
                $('#QuantityOrdered').text(deliveryNote.total_qty);
                $('#SelectedBatch').text(deliveryNote.items[0].batch_no);
                $('#TotalSerialNumbers').text(deliveryNote.items[0].actual_batch_qty);
            }

            RefreshPalletSerials();
            RefreshTotalSerialsForDeliveryNote();
        }
    });
});

function AddNewPallet() {
    if (window.confirm("Are you sure you want to create a new pallet?")) {
        frappe.call({
            "method": "erpnext.stock.page.pallet_aggregation.pallet_aggregation.add_pallet",
            args: {
                deliveryNoteName: deliveryNoteName
            },
            callback: function (r) {
                RefreshPalletSerials();
            }
        });
    }
}

function RefreshPalletSerials() {
    frappe.call({
        "method": "erpnext.stock.page.pallet_aggregation.pallet_aggregation.get_pallet_serials",
        args: {
            deliveryNoteName: deliveryNoteName
        },
        callback: function (r) {
            $("#PalletTable tbody").empty();
            for (var i = 0; i < r.message.length; i++) {
                $("#PalletTable tbody").append(MakePalletRowHtml(r.message[i]));
            }

            $("#PalletTable tbody tr").click(function () {
                selectedPalletSerial = $(this).attr('data-pallet-serial');
                $("#PalletTable tbody tr").removeClass("selected");

                $(this).addClass("selected");
                $("#SelectedPallet").text(selectedPalletSerial);

                RefreshPalletChildSerials();
                RefreshTotalSerialsForDeliveryNote();
            });

            $('.primary-action').append('<i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Finalize</span>').removeClass('hide').click(function () {
                frappe.call({
                    "method": "erpnext.stock.page.pallet_aggregation.pallet_aggregation.set_pallet_aggregation_completed",
                    args: {
                        deliveryNoteName: deliveryNoteName
                    },
                    callback: function (r) {
                        window.location = 'https://erp.lohxa.com/desk#List/Delivery%20Note/' + deliveryNoteName;
                    }
                });
            });
        }
    });
}
function RefreshPalletChildSerials() {
    frappe.call({
        "method": "erpnext.stock.page.pallet_aggregation.pallet_aggregation.get_pallet_child_serials",
        args: {
            serialNo: selectedPalletSerial
        },
        callback: function (r) {
            var serialCount = 0;
            var data = r.message;
            SelectedChildSerials = [];
            $("#ChildCaseTable tbody").empty();
            if (data) {
                for (var c = 0; c < data.length; c++) {
                    serialCount += parseInt(data[c][1]);
                    $("#ChildCaseTable tbody").append('<tr><td><span class="text-semibold text-left">' + data[c][0] + '</span></td><td class="text-right"><span>' + data[c][1] + '</span></td></tr>');
                }
            }
            var casesScanned = $("#ChildCaseTable tbody tr").length;

            $('.palletRow.selected .palletCasesScanned').text(casesScanned);
            $('#TotalItemsScanned').text(serialCount);
            $('#CasesScanned').text(casesScanned);
        }
    });
}
function RefreshTotalSerialsForDeliveryNote() {
    frappe.call({
        "method": "erpnext.stock.page.pallet_aggregation.pallet_aggregation.get_deliveryNote_serial_count",
        args: {
            deliveryNoteName: deliveryNoteName
        },
        callback: function (r) {
            var data = r.message;
            $('#TotalItemsScannedForDelivery').text(data);
        }
    });
}
function MakePalletRowHtml(arrayData) {
    return '<tr class="palletRow" data-pallet-serial="' + arrayData[0] + '"><td><span class="text-semibold">' + arrayData[0] + '</span></td><td class="text-center"><span class="text-muted palletCasesScanned">' + arrayData[1] + '</span></td><td class="col-md-2 text-right"><button class="btn btn-primary btn-sm reprint"><i class="visible-xs octicon octicon-plus"></i><span class="hidden-xs">Print</span></button ></td></tr>';
}
function ScanCode(code) {
    var serial = code.substring(18, 27);
    ScanSerial(serial);
}
function ScanSerial(serial) {
    if (serial.startsWith("3")) {
        var trs = $("#PalletTable table tr");
        for (var i = 0; i < trs.length; i++) {
            if ($(trs[i]).attr("data-pallet-serial") == serial) {
                $(trs[i]).click();
            }
        }
    }
    else if (serial.startsWith("1")) {
        alert("You can't scan individual items on this screen");
        return;
    }
    else {
        frappe.call({
            "method": "erpnext.stock.page.pallet_aggregation.pallet_aggregation.add_case_to_pallet",
            args: {
                palletSerial: selectedPalletSerial,
                caseSerial: serial
            },
            callback: function (r) {
                $("#PalletTable table tbody tr.selected").click();
            }
        });
    }
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