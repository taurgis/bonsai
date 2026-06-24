Jobs: System

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

# OCAPI System Jobs

Copy as Markdown

View as Markdown

Copy URL to Markdown

System jobs are predefined jobs called via the following OCAPI request:

```txt
POST dw/data/v24_5/jobs/{job_id}/executions
```

Calling this resource triggers a background job and retrieves a response document containing information about the job’s status. Different System Jobs can use different request payloads.

The job ID always starts with `sfcc-`. This prefix is a namespace specific to B2C Commerce System Jobs. You can’t use it in custom job IDs.

Currently available system jobs can be found in [Global Jobs](/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/globaljobs.html).

A System Job request looks like a basic OCAPI Data API request, but can have its own request document. An example is shown here for the site archive import job:

```txt
REQUEST:
      POST /dw/data/v24_5/jobs/sfcc-site-archive-import/executions HTTP/1.1
      Host: example.com
      Accept: application/json
      Authorization: Bearer <access_token>
      {
          "file_name": "siteGenesis.zip",
          "mode": "merge"
      }

      RESPONSE:
      HTTP/1.1 202 ACCEPTED
      Content-Type: application/json;charset=UTF-8
      Content-Length: 741
      {
          "_v" : "24.5",
          _type": "job_execution",
          "client_id": "[your_own_client_id]",
          "execution_status": "pending",
          "id": "42",
          "is_log_file_existing": false,
          "is_restart": false,
          "job_id": "sfcc-site-archive-import",
          "log_file_name": "Job-sfcc-site-archive-import-20170512142357242.log",
          "modification_time": "2017-05-12T14:23:57.316Z",
          "parameters": [ {
            "_type": "job_execution_parameter",
            "name": "ImportMode",
            "value": "merge"
          }, {
            "_type": "job_execution_parameter",
            "name": "ImportFile",
            "value": "siteGenesis.zip"
          } ],
          "status": "PENDING"
      }
```
