# -*- coding: utf-8 -*-
# Copyright (c) 2015, ESS LLP and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.utils import cint

@frappe.whitelist()
def reprint_unscanned(stockEntryName):
    productionOrder = frappe.db.get_value("Stock Entry", stockEntryName, "production_order")
    boxItem = frappe.db.get_value("Production Order", productionOrder, "box_item")

    result = frappe.db.sql("""select serialNo.name
		from `tabSerial No` as serialNo
		left join `tabChild Serial No Details` as childSerial
		on childSerial.serial_no = serialNo.name
		where serialNo.purchase_document_no=%(name)s
		and serialNo.item_code=%(item)s
        and childSerial.serial_no is null
		order by serialNo.creation desc""",
		{
			"item": boxItem,
			"name": stockEntryName
		}, as_dict=True)
    if not result:
        frappe.throw("There are no unscanned serial numbers for this stock entry")
    else:
        reprintRequest = frappe.new_doc("Serial Reprint Request")
        reprintRequest.item = boxItem
        reprintRequest.insert()
        reprintRequest.save()
        
        for serial in result:
            reprintRequest.append("serial_no_list", {
                'serial_no' : serial.name
                })
            
        reprintRequest.save()
        reprintRequest.submit()
    return result

@frappe.whitelist()
def get_unscanned_stock_entry_serials(stockEntryName):
    productionOrder = frappe.db.get_value("Stock Entry", stockEntryName, "production_order")
    boxItem = frappe.db.get_value("Production Order", productionOrder, "box_item")

    result = frappe.db.sql("""select serialNo.name
		from `tabSerial No` as serialNo
		left join `tabChild Serial No Details` as childSerial
		on childSerial.serial_no = serialNo.name
		where serialNo.purchase_document_no=%(name)s
		and serialNo.item_code=%(item)s
        and childSerial.serial_no is null
		order by serialNo.creation desc""",
		{
			"item": boxItem,
			"name": stockEntryName
		}, as_dict=True)

    return result

@frappe.whitelist()
def get_case_serials(stockEntryName):
	productionOrder = frappe.db.get_value("Stock Entry", stockEntryName, "production_order")
	productionItem = frappe.db.get_value("Production Order", productionOrder, "production_item")

	result = frappe.db.sql("""select serialNo.name, count(childSerial.serial_no)
		from `tabSerial No` as serialNo
		left join `tabChild Serial No Details` as childSerial
		on childSerial.parent = serialNo.name
		where serialNo.purchase_document_no=%(name)s
		and serialNo.item_code=%(item)s
		group by serialNo.name
		order by serialNo.creation desc""",
		{
			"item": productionItem,
			"name": stockEntryName
		})

	return result

@frappe.whitelist()
def set_case_aggregation_completed(stockEntryName):
	frappe.db.set_value("Stock Entry",stockEntryName,"case_aggregation_completed",1)

@frappe.whitelist()
def make_reprint_request(serial_no, item):
	reprintRequest = frappe.new_doc("Serial Reprint Request")
	reprintRequest.item = item
	reprintRequest.serial_no = serial_no
	reprintRequest.insert()
	reprintRequest.submit()

@frappe.whitelist()
def get_case_child_serials(serialNo):
	result = frappe.db.sql("""select serial_no
		from `tabChild Serial No Details`
		where parent=%(name)s
		order by serial_no asc""",
		{
			"name": serialNo
		}, as_dict=True)

	return result

@frappe.whitelist()
def add_serial_to_case(caseSerial, child_serial):
	result = frappe.db.sql("""select count(name)
		from `tabChild Serial No Details`
		where serial_no=%(name)s""",
		{
			"name": child_serial
		})[0][0]
	if(int(result) > 0):
		frappe.throw("Box was already added to another Case. Try again.")

	case = frappe.get_doc("Serial No", caseSerial)
	case.append("sub_item_serial_numbers", {
		'serial_no': child_serial
	})
	case.save(ignore_permissions=True)
	return 'Success'

@frappe.whitelist()
def remove_serial_from_case(caseSerial, child_serial):
	case = frappe.get_doc("Serial No", caseSerial)
	for serial in case.sub_item_serial_numbers:
		if(serial.serial_no == child_serial):
			case.sub_item_serial_numbers.remove(serial)
	
	case.save(ignore_permissions=True)
	return 'Success'
