# -*- coding: utf-8 -*-
# Copyright (c) 2015, ESS LLP and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.utils import cint
from frappe.model.naming import make_autoname

@frappe.whitelist()
def reprint_unscanned(stockEntryName):
    productionOrder = frappe.db.get_value("Stock Entry", stockEntryName, "work_order")
    boxItem = frappe.db.get_value("Work Order", productionOrder, "box_item")

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
    productionOrder = frappe.db.get_value("Stock Entry", stockEntryName, "work_order")
    boxItem = frappe.db.get_value("Work Order", productionOrder, "box_item")

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
def get_pallet_serials(deliveryNoteName):
	result = frappe.db.sql("""select serialNo.name, count(childSerial.serial_no)
		from `tabSerial No` as serialNo
		left join `tabChild Serial No Details` as childSerial
		on childSerial.parent = serialNo.name
		where serialNo.delivery_document_no=%(deliveryNote)s
		and serialNo.item_code=%(item)s
		group by serialNo.name
		order by serialNo.creation desc""",
		{
			"item": "PALLET",
			"deliveryNote": deliveryNoteName
		})

	return result

import json

@frappe.whitelist()
def get_child_serial_count(serialNos):
	serials = serialNos.split(',')
	result = frappe.db.sql("""select count(*)
		from `tabChild Serial No Details`
		where parent in (%s)"""  % (','.join(['%s'] * len(serials))), tuple(serials))
	return result

@frappe.whitelist()
def get_pallet_serial_count(serialNos):
	serials = serialNos.split(',')

	palletResult = frappe.db.sql("""select serial_no
		from `tabChild Serial No Details`
		where parent in (%s)"""  % (','.join(['%s'] * len(serials))), tuple(serials))

	result = frappe.db.sql("""select count(*)
		from `tabChild Serial No Details`
		where parent in (%s)"""  % (','.join(['%s'] * len(palletResult))), tuple(palletResult))

	return result

@frappe.whitelist()
def get_deliveryNote_serial_count(deliveryNoteName):
	deliveryNoteResult = frappe.db.sql("""select serial_no
		from `tabSerial No`
		where delivery_document_no=%(deliveryNote)s
		and item_code=%(item)s""",
		{
			"item": "PALLET",
			"deliveryNote": deliveryNoteName
		})

	if(deliveryNoteResult):
		palletResult = frappe.db.sql("""select serial_no
			from `tabChild Serial No Details`
			where parent in (%s)"""  % (','.join(['%s'] * len(deliveryNoteResult))), tuple(deliveryNoteResult))

		if(palletResult):
			result = frappe.db.sql("""select count(*)
				from `tabChild Serial No Details`
				where parent in (%s)"""  % (','.join(['%s'] * len(palletResult))), tuple(palletResult))
			return result
	
	return '0'	

@frappe.whitelist()
def print_serial_number(serialNo):
	frappe.db.set_value("Serial No", serialNo, "print_label", "1")
	frappe.msgprint("Print request sent to the printer")

@frappe.whitelist()
def get_deliveryNote_serial_numbers(deliveryNoteName):
	deliveryNoteResult = frappe.db.sql("""select serial_no
		from `tabSerial No`
		where delivery_document_no=%(deliveryNote)s
		and item_code=%(item)s""",
		{
			"item": "PALLET",
			"deliveryNote": deliveryNoteName
		})

	palletResult = frappe.db.sql("""select serial_no
		from `tabChild Serial No Details`
		where parent in (%s)"""  % (','.join(['%s'] * len(deliveryNoteResult))), tuple(deliveryNoteResult))

	result = frappe.db.sql("""select serial_no
		from `tabChild Serial No Details`
		where parent in (%s)"""  % (','.join(['%s'] * len(palletResult))), tuple(palletResult))

	return result

@frappe.whitelist()
def add_pallet(deliveryNoteName):
	item_det = get_item_details('PALLET')

	sr = frappe.new_doc("Serial No")
	sr.warehouse = None
	sr.flags.ignore_permissions = True
	sr.serial_no = make_autoname(item_det.serial_no_series, 1)
	sr.item_code = 'PALLET'
	sr.company = 'Lohxa LLC'
	sr.delivery_document_type = 'Delivery Note'
	sr.delivery_document_no = deliveryNoteName
	sr.print_label = 1
	sr.insert()

	return sr.name

def get_item_details(item_code):
	return frappe.db.sql("""select name, has_batch_no, docstatus,
		is_stock_item, has_serial_no, serial_no_series
		from tabItem where name=%s""", item_code, as_dict=True)[0]

@frappe.whitelist()
def set_pallet_aggregation_completed(deliveryNoteName):
	serialNumbers = get_deliveryNote_serial_numbers(deliveryNoteName)
	deliveryNote = frappe.get_doc("Delivery Note", deliveryNoteName)
	deliveryNote.items[0].qty = len(serialNumbers)
	deliveryNote.items[0].serial_no = '\n'.join(''.join(elems) for elems in serialNumbers)
	deliveryNote.save(ignore_permissions=True)
	#frappe.db.set_value("Delivery Note",deliveryNoteName,"pallet_aggregation_completed",1)

@frappe.whitelist()
def make_reprint_request(serial_no, item):
	reprintRequest = frappe.new_doc("Serial Reprint Request")
	reprintRequest.item = item
	reprintRequest.serial_no = serial_no
	reprintRequest.insert()
	reprintRequest.submit()

@frappe.whitelist()
def get_pallet_child_serials(serialNo):
	result = frappe.db.sql("""select parent.serial_no, count(child.name) as count
		from `tabChild Serial No Details` as parent 
		left join `tabChild Serial No Details` as child 
		on child.parent = parent.serial_no 
		where parent.parent=%(name)s 
		group by parent.serial_no 
		order by parent.serial_no asc""",
		{
			"name": serialNo
		})

	return result

@frappe.whitelist()
def add_case_to_pallet(palletSerial, caseSerial):
	result = frappe.db.sql("""select count(name)
		from `tabChild Serial No Details`
		where serial_no=%(name)s""",
		{
			"name": caseSerial
		})
	if(int(result) > 0):
		frappe.throw("Case was already added to another Pallet. Try again.")

	case = frappe.get_doc("Serial No", palletSerial)
	case.append("sub_item_serial_numbers", {
		'serial_no': caseSerial
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
