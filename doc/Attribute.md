"/DataService/anchor/v1/{domainconcept}/{anchor}/attributes": {
            "get": {
                "tags": [
                    "Anchor Attributes"
                ],
                "summary": "Returns all attributes that belong to an entity.",
                "description": "Returns all attributes that belong to an entity.",
                "parameters": [
                    {
                        "name": "domainconcept",
                        "in": "path",
                        "description": "Concept the attribute belongs to. (.e.g. \"assets\")",
                        "required": true,
                        "schema": {
                            "pattern": "^(assets|aspects)$",
                            "type": "string"
                        }
                    },
                    {
                        "name": "anchor",
                        "in": "path",
                        "description": "Unique identifier of an entity.",
                        "required": true,
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    },
                    {
                        "name": "namefilter",
                        "in": "query",
                        "description": "one or multiple filter statements. Default: `*`",
                        "schema": {
                            "type": "string",
                            "default": ""
                        }
                    },
                    {
                        "name": "typefilter",
                        "in": "query",
                        "description": "UUID of the AttributeType the response has to match or be inherited from. Default: Empty, filter not active.",
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    },
                    {
                        "name": "reference",
                        "in": "query",
                        "description": "UUID of the anchor **after** which the result set shall start. Default: Empty, start with the first entry.",
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "description": "Maximum offset of entries with respect to the provided reference. Default: `0`",
                        "schema": {
                            "type": "integer",
                            "format": "int32",
                            "default": 0
                        }
                    },
                    {
                        "name": "take",
                        "in": "query",
                        "description": "Maximum number of entries in the result. Default: `20`",
                        "schema": {
                            "type": "integer",
                            "format": "int32",
                            "default": 20
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Value of the attribute or attribute definition with details.",
                        "headers": {
                            "x-anchor-position": {
                                "description": "Position of the anchor provided as reference.",
                                "schema": {
                                    "type": "integer",
                                    "description": "Position of the anchor provided as reference.",
                                    "format": ""
                                }
                            },
                            "x-anchor-count": {
                                "description": "Overall count of results.",
                                "schema": {
                                    "type": "integer",
                                    "description": "Overall count of results.",
                                    "format": ""
                                }
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "$ref": "#/components/schemas/Attribute"
                                    }
                                }
                            }
                        }
                    },
                    "304": {
                        "$ref": "#/components/responses/DataNotModified"
                    },
                    "400": {
                        "$ref": "#/components/responses/RequestMalformed"
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "405": {
                        "$ref": "#/components/responses/MethodNotAllowed"
                    },
                    "410": {
                        "$ref": "#/components/responses/ResourceGone"
                    },
                    "415": {
                        "$ref": "#/components/responses/UnsupportedMediaType"
                    },
                    "422": {
                        "$ref": "#/components/responses/UnprocessableEntity"
                    },
                    "429": {
                        "$ref": "#/components/responses/RequestRejected"
                    },
                    "500": {
                        "$ref": "#/components/responses/InternalError"
                    }
                }
            },
            "post": {
                "tags": [
                    "Anchor Attributes"
                ],
                "summary": "Creates an attribute.",
                "description": "Creates an attribute.",
                "parameters": [
                    {
                        "name": "domainconcept",
                        "in": "path",
                        "description": "Concept the attribute belongs to. (.e.g. \"assets\")",
                        "required": true,
                        "schema": {
                            "pattern": "^(assets|aspects)$",
                            "type": "string"
                        }
                    },
                    {
                        "name": "anchor",
                        "in": "path",
                        "description": "Unique identifier of an entity.",
                        "required": true,
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    }
                ],
                "requestBody": {
                    "description": "Definition of the attribute.",
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/Attribute"
                            }
                        }
                    },
                    "required": true
                },
                "responses": {
                    "201": {
                        "description": "JSON document of the created Attribute serialized according to schema `Attribute`."
                    },
                    "304": {
                        "$ref": "#/components/responses/DataNotModified"
                    },
                    "400": {
                        "$ref": "#/components/responses/RequestMalformed"
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "405": {
                        "$ref": "#/components/responses/MethodNotAllowed"
                    },
                    "410": {
                        "$ref": "#/components/responses/ResourceGone"
                    },
                    "415": {
                        "$ref": "#/components/responses/UnsupportedMediaType"
                    },
                    "422": {
                        "$ref": "#/components/responses/UnprocessableEntity"
                    },
                    "429": {
                        "$ref": "#/components/responses/RequestRejected"
                    },
                    "500": {
                        "$ref": "#/components/responses/InternalError"
                    }
                }
            }
        }