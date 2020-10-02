# -*- coding: utf-8 -*-
# Copyright (c) 2015, ESS LLP and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.utils import cint

@frappe.whitelist()
def get_case_serials(stockEntryName):
	result = frappe.db.sql("""select serialNo.name, count(childSerial.serial_no)
		from `tabSerial No` as serialNo
		left join `tabChild Serial No Details` as childSerial
		on childSerial.parent = serialNo.name
		where serialNo.purchase_document_no=%(name)s
		and serialNo.item_code=%(item)s
		group by serialNo.name
		order by serialNo.creation desc""",
		{
			"item": "test-1234-Case",
			"name": stockEntryName
		})

	return result

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

@frappe.whitelist()
def get_production_list(attr):
	result = frappe.db.sql("""select prodOrder.name, prodOrder.docstatus, prodOrder.modified, prodOrder.production_item, item.item_name, item.description, prodOrder.status, prodOrder.qty, prodOrder.produced_qty, prodOrder.planned_start_date
		from `tabProduction Order` as prodOrder
		inner join `tabItem` as item
		on prodOrder.production_item = item.name
		where prodOrder.docstatus != 2 and prodOrder.status != %(status)s
		order by prodOrder.planned_start_date asc""",
		{
			"status": "Completed"
		})

	return result