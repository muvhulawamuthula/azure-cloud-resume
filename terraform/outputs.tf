output "resource_group_name" {
  value = azurerm_resource_group.resume_rg.name
}

output "static_web_app_name" {
  value = azurerm_static_web_app.resume_site.name
}

output "static_web_app_default_hostname" {
  value = azurerm_static_web_app.resume_site.default_host_name
}