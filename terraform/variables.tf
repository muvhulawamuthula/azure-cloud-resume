variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = "azure-cloud-resume-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "West Europe"
}

variable "static_web_app_name" {
  description = "Azure Static Web App name"
  type        = string
  default     = "azure-cloud-resume"
}