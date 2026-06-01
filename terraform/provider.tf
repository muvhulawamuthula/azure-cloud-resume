terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Remote state on Azure Storage. The backing storage (tfstate-rg /
  # muvtfstateresume / tfstate container) is bootstrapped out-of-band with the
  # Azure CLI so it is NOT managed by this config (avoids the chicken-and-egg of
  # destroying the store that holds the state).
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "muvtfstateresume"
    container_name       = "tfstate"
    key                  = "azure-cloud-resume.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {}
}