resource "azurerm_resource_group" "resume_rg" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    project    = "azure-cloud-resume"
    managed_by = "terraform"
  }
}

resource "azurerm_static_web_app" "resume_site" {
  name                = var.static_web_app_name
  resource_group_name = azurerm_resource_group.resume_rg.name
  location            = azurerm_resource_group.resume_rg.location

  sku_tier = "Free"
  sku_size = "Free"

  tags = {
    project    = "azure-cloud-resume"
    managed_by = "terraform"
  }

  lifecycle {
    ignore_changes = [
      repository_url,
      repository_branch,
      repository_token
    ]
  }

}
resource "azurerm_storage_account" "resume_storage" {
  name                     = "muvresumevisitorstore"
  resource_group_name      = azurerm_resource_group.resume_rg.name
  location                 = azurerm_resource_group.resume_rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    project    = "azure-cloud-resume"
    managed_by = "terraform"
  }
}

resource "azurerm_storage_table" "visitor_counter" {
  name                 = "VisitorCounter"
  storage_account_name = azurerm_storage_account.resume_storage.name
}