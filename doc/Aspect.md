"/DataService/anchor/v1/aspects": {
            "post": {
                "tags": [
                    "Anchor Aspects"
                ],
                "summary": "Creates an aspect.",
                "description": "Creates an aspect. All depending types must be known to the system. Attributes are always specific to the entity and can only be-reused in case of a constant behavior of the associated attribute type. Attributes can always consist of a value (in this case the value must match the attribute type's data type) and a attribute type definition. The latter is required for instance-specific attributes. If the complete attribute type definition is present, the system must check if the definition is identical to the already known one which might have come from the entity type.",
                "requestBody": {
                    "description": "JSON document of the Aspect to be created. Missing $anchor-identifiers will automatically be created. `$concept` (if present) must be set to value `aspect`.",
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/Entity"
                            }
                        }
                    },
                    "required": true
                },
                "responses": {
                    "201": {
                        "description": "JSON document of the newly created aspect instance serialized according to schema `Entity`.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/Entity"
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
            "get": {
                "tags": [
                    "Anchor Aspects"
                ],
                "summary": "Returns all aspects.",
                "description": "Returns all aspects.",
                "parameters": [
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
                        "description": "UUID of the AspectType the response has to match or be inherited from. Default: Empty, filter not active.",
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
                    },
                    {
                        "name": "selectors",
                        "in": "query",
                        "description": "one or multiple selector statements. Default: `+$anchor,+$attributes`",
                        "schema": {
                            "type": "string",
                            "default": "+$anchor,+$attributes"
                        }
                    },
                    {
                        "name": "expanded",
                        "in": "query",
                        "description": "Sub entities within attributes shall be automatically expanded and serialized along. Default: `false`",
                        "schema": {
                            "type": "boolean",
                            "default": false
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "JSON document with array of Aspect instances serialized according to schema `Entity`. `$concept` (if present) is always set to value `aspect`.",
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
                                        "$ref": "#/components/schemas/Entity"
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
            }
        }