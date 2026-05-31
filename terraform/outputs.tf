output "resource_group_name" {
  value = azurerm_resource_group.resume_rg.name
}

output "static_web_app_name" {
  value = azurerm_static_web_app.resume_site.name
}

output "static_web_app_default_hostname" {
  value = azurerm_static_web_app.resume_site.default_host_name
}

output "storage_account_name" {
  value = azurerm_storage_account.resume_storage.name
}

output "visitor_counter_table_name" {
  value = azurerm_storage_table.visitor_counter.name
}
output "application_insights_connection_string" {
  value     = azurerm_application_insights.resume_insights.connection_string
  sensitive = true
}